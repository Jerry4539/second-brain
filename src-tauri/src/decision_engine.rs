use ort::session::Session;
use ort::value::Tensor;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tokenizers::Tokenizer;

/// Local decision engine: a Laya-multilingual (mmBERT-base, 322M) checkpoint
/// exported to ONNX (see scripts/export-laya-onnx.py) and run fully offline via
/// onnxruntime, no Python/API key/cost — replaces the paid Jev API from the
/// spec with a free, local, always-available "System 1" typed-decision model.
/// Loaded lazily on first use (see spec section 5: don't start runtimes at launch).
struct LoadedEngine {
  session: Session,
  tokenizer: Tokenizer,
  config: LayaConfig,
}

#[derive(Deserialize, Clone)]
struct LayaConfig {
  max_len: usize,
  head_max_len: usize,
  temperature: [f32; 3],
  #[serde(default)]
  temperature_by_options: std::collections::HashMap<String, f32>,
  mask_token: String,
  mask_token_id: i64,
  cls_token_id: i64,
  sep_token_id: i64,
  pad_token_id: i64,
}

#[derive(Default)]
pub struct DecisionEngineState {
  engine: Mutex<Option<LoadedEngine>>,
  ort_initialized: AtomicBool,
}

#[derive(Serialize, Clone)]
pub struct DecisionEngineStatus {
  pub available: bool,
}

#[derive(Deserialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum QuestionDef {
  Choice {
    instructions: String,
    criteria: Vec<ChoiceOption>,
  },
  Score {
    instructions: String,
    levels: Vec<String>,
  },
  #[serde(rename_all = "camelCase")]
  Noul {
    instructions: String,
    #[serde(default)]
    true_description: Option<String>,
    #[serde(default)]
    false_description: Option<String>,
  },
}

#[derive(Deserialize, Clone)]
pub struct ChoiceOption {
  key: String,
  #[serde(default)]
  description: Option<String>,
}

fn laya_dir(app: &AppHandle) -> Result<PathBuf, String> {
  crate::paths::resolve_resource(app, "laya")
}

fn onnxruntime_dylib_path(app: &AppHandle) -> Result<PathBuf, String> {
  let name = if cfg!(windows) {
    "onnxruntime.dll"
  } else if cfg!(target_os = "macos") {
    "libonnxruntime.dylib"
  } else {
    "libonnxruntime.so"
  };
  let sub = format!("onnxruntime/{name}");
  crate::paths::resolve_resource(app, &sub)
}

#[tauri::command]
pub fn decision_engine_status(app: AppHandle) -> Result<DecisionEngineStatus, String> {
  let dir = laya_dir(&app)?;
  let available = onnxruntime_dylib_path(&app)?.exists()
    && dir.join("model.onnx").exists()
    && dir.join("laya_config.json").exists()
    && dir.join("tokenizer").join("tokenizer.json").exists();
  Ok(DecisionEngineStatus { available })
}

fn ensure_loaded<'a>(
  app: &AppHandle,
  state: &'a DecisionEngineState,
) -> Result<std::sync::MutexGuard<'a, Option<LoadedEngine>>, String> {
  let mut guard = state.engine.lock().map_err(|e| e.to_string())?;
  if guard.is_some() {
    return Ok(guard);
  }

  if !state.ort_initialized.load(Ordering::SeqCst) {
    let dylib = onnxruntime_dylib_path(app)?;
    if !dylib.exists() {
      return Err(format!("onnxruntime library not found at {}", dylib.display()));
    }
    ort::init_from(dylib.to_string_lossy().to_string())
      .map_err(|e| format!("failed to load onnxruntime: {e}"))?
      .commit();
    state.ort_initialized.store(true, Ordering::SeqCst);
  }

  let dir = laya_dir(app)?;
  let config_bytes = std::fs::read(dir.join("laya_config.json"))
    .map_err(|e| format!("failed to read laya_config.json: {e}"))?;
  let config: LayaConfig =
    serde_json::from_slice(&config_bytes).map_err(|e| format!("invalid laya_config.json: {e}"))?;

  let tokenizer = Tokenizer::from_file(dir.join("tokenizer").join("tokenizer.json"))
    .map_err(|e| format!("failed to load tokenizer: {e}"))?;

  let session = Session::builder()
    .map_err(|e| e.to_string())?
    .commit_from_file(dir.join("model.onnx"))
    .map_err(|e| format!("failed to load model.onnx: {e}"))?;

  *guard = Some(LoadedEngine {
    session,
    tokenizer,
    config,
  });
  Ok(guard)
}

fn qtype_index(q: &QuestionDef) -> i64 {
  match q {
    QuestionDef::Choice { .. } => 0,
    QuestionDef::Score { .. } => 1,
    QuestionDef::Noul { .. } => 2,
  }
}

fn qtype_name(q: &QuestionDef) -> &'static str {
  match q {
    QuestionDef::Choice { .. } => "choice",
    QuestionDef::Score { .. } => "score",
    QuestionDef::Noul { .. } => "noul",
  }
}

/// Option texts in index order — index i is what marker i's logit scores.
fn render_options(q: &QuestionDef) -> Vec<String> {
  match q {
    QuestionDef::Choice { criteria, .. } => criteria
      .iter()
      .map(|c| match &c.description {
        Some(d) if !d.is_empty() => format!("{}: {}", c.key, d),
        _ => c.key.clone(),
      })
      .collect(),
    QuestionDef::Score { levels, .. } => levels
      .iter()
      .enumerate()
      .map(|(i, l)| format!("level {i}: {l}"))
      .collect(),
    QuestionDef::Noul {
      true_description,
      false_description,
      ..
    } => {
      let false_text = false_description
        .clone()
        .unwrap_or_else(|| "no, the statement does not hold".to_string());
      let true_text = true_description
        .clone()
        .unwrap_or_else(|| "yes, the statement holds".to_string());
      vec![format!("false: {false_text}"), format!("true: {true_text}")]
    }
  }
}

fn instructions(q: &QuestionDef) -> &str {
  match q {
    QuestionDef::Choice { instructions, .. } => instructions,
    QuestionDef::Score { instructions, .. } => instructions,
    QuestionDef::Noul { instructions, .. } => instructions,
  }
}

fn encode_ids(tokenizer: &Tokenizer, text: &str) -> Result<Vec<i64>, String> {
  let encoding = tokenizer
    .encode(text, false)
    .map_err(|e| format!("tokenizer error: {e}"))?;
  Ok(encoding.get_ids().iter().map(|&id| id as i64).collect())
}

/// Rust port of laya.common.build_sequence: "[CLS] <type> question: <instructions>
/// [SEP] [MASK] opt0 [MASK] opt1 ... [SEP] state [SEP]", trimmed to head_max_len/max_len.
fn build_sequence(
  tokenizer: &Tokenizer,
  cfg: &LayaConfig,
  state_text: &str,
  q: &QuestionDef,
) -> Result<(Vec<i64>, Vec<usize>), String> {
  let mask = cfg.mask_token.as_str();
  let clean = |s: &str| s.replace(mask, " ");

  let head_text = format!("{} question: {}", qtype_name(q), clean(instructions(q)));
  let mut head_ids = encode_ids(tokenizer, &head_text)?;

  let opts = render_options(q);
  let mut opt_ids: Vec<Vec<i64>> = Vec::with_capacity(opts.len());
  for opt in &opts {
    let mut ids = vec![cfg.mask_token_id];
    let mut rest = encode_ids(tokenizer, &format!(" {}", clean(opt)))?;
    rest.truncate(48);
    ids.append(&mut rest);
    opt_ids.push(ids);
  }

  let opt_len_sum = |ids: &[Vec<i64>]| -> i64 { ids.iter().map(|o| o.len() as i64).sum() };
  let mut opt_budget = cfg.head_max_len as i64 - opt_len_sum(&opt_ids);
  if opt_budget < 16 {
    let per = std::cmp::max(4, (cfg.head_max_len as i64 - 16) / std::cmp::max(1, opt_ids.len() as i64)) as usize;
    for o in opt_ids.iter_mut() {
      o.truncate(per);
    }
    opt_budget = cfg.head_max_len as i64 - opt_len_sum(&opt_ids);
  }
  head_ids.truncate(std::cmp::max(8, opt_budget) as usize);

  let mut ids = vec![cfg.cls_token_id];
  ids.extend(head_ids);
  ids.push(cfg.sep_token_id);

  let mut markers = Vec::with_capacity(opt_ids.len());
  for opt in &opt_ids {
    markers.push(ids.len());
    ids.extend(opt.iter().copied());
  }
  ids.push(cfg.sep_token_id);

  let room = cfg.max_len.saturating_sub(ids.len() + 1);
  let mut state_ids = encode_ids(tokenizer, &clean(state_text))?;
  state_ids.truncate(room);
  ids.extend(state_ids);
  ids.push(cfg.sep_token_id);

  ids.truncate(cfg.max_len);
  let markers: Vec<usize> = markers.into_iter().filter(|&m| m < cfg.max_len).collect();
  Ok((ids, markers))
}

fn temp_bucket(qtype_name: &str, k: usize) -> String {
  let size = if k <= 2 {
    "2"
  } else if k <= 5 {
    "3-5"
  } else if k <= 10 {
    "6-10"
  } else {
    "11+"
  };
  format!("{qtype_name}:{size}")
}

fn confidence_from_probs(p: &[f32], k: usize) -> f64 {
  if k < 2 {
    return 1.0;
  }
  let ent: f64 = -p[..k]
    .iter()
    .map(|&v| {
      let v = (v as f64).max(1e-12);
      v * v.ln()
    })
    .sum::<f64>();
  (1.0 - ent / (k as f64).ln()).clamp(0.0, 1.0)
}

fn softmax(logits: &[f32]) -> Vec<f32> {
  let max = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
  let exps: Vec<f32> = logits.iter().map(|&v| (v - max).exp()).collect();
  let sum: f32 = exps.iter().sum();
  exps.iter().map(|&v| v / sum).collect()
}

#[tauri::command]
pub fn make_decision(
  app: AppHandle,
  state: State<'_, DecisionEngineState>,
  input_state: Value,
  questions: std::collections::BTreeMap<String, QuestionDef>,
) -> Result<Value, String> {
  let mut guard = ensure_loaded(&app, &state)?;
  let engine = guard.as_mut().expect("just loaded");

  let state_text = match &input_state {
    Value::String(s) => s.clone(),
    other => serde_json::to_string(other).map_err(|e| e.to_string())?,
  };

  run_questions(
    &mut engine.session,
    &engine.tokenizer,
    &engine.config,
    &state_text,
    &questions,
  )
}

/// Runs a batch of typed questions against one state through the Laya ONNX
/// model and decodes the answers. Shared by the Tauri command and tests so the
/// pipeline can be verified without a running Tauri app.
fn run_questions(
  session: &mut Session,
  tokenizer: &Tokenizer,
  config: &LayaConfig,
  state_text: &str,
  questions: &std::collections::BTreeMap<String, QuestionDef>,
) -> Result<Value, String> {
  let ids: Vec<&String> = questions.keys().collect();
  let mut items: Vec<(Vec<i64>, Vec<usize>, i64)> = Vec::with_capacity(ids.len());
  for id in &ids {
    let q = &questions[*id];
    let (seq, markers) = build_sequence(tokenizer, config, state_text, q)?;
    if markers.len() != render_options(q).len() {
      return Err(format!("question {id:?} options exceed head_max_len"));
    }
    items.push((seq, markers, qtype_index(q)));
  }

  let n = items.len();
  let max_seq_len = items.iter().map(|(ids, _, _)| ids.len()).max().unwrap_or(0);
  let kmax = items.iter().map(|(_, m, _)| m.len()).max().unwrap_or(0).max(1);

  let mut input_ids = vec![config.pad_token_id; n * max_seq_len];
  let mut attention_mask = vec![0i64; n * max_seq_len];
  let mut marker_pos = vec![0i64; n * kmax];
  let mut marker_mask = vec![false; n * kmax];
  let mut qtype = vec![0i64; n];

  for (row, (ids, markers, qt)) in items.iter().enumerate() {
    for (col, &tok) in ids.iter().enumerate() {
      input_ids[row * max_seq_len + col] = tok;
      attention_mask[row * max_seq_len + col] = 1;
    }
    for (col, &m) in markers.iter().enumerate() {
      marker_pos[row * kmax + col] = m as i64;
      marker_mask[row * kmax + col] = true;
    }
    qtype[row] = *qt;
  }

  let input_ids_tensor = Tensor::from_array(([n, max_seq_len], input_ids.into_boxed_slice())).map_err(|e| e.to_string())?;
  let attention_mask_tensor =
    Tensor::from_array(([n, max_seq_len], attention_mask.into_boxed_slice())).map_err(|e| e.to_string())?;
  let marker_pos_tensor = Tensor::from_array(([n, kmax], marker_pos.into_boxed_slice())).map_err(|e| e.to_string())?;
  let marker_mask_tensor = Tensor::from_array(([n, kmax], marker_mask.into_boxed_slice())).map_err(|e| e.to_string())?;
  let qtype_tensor = Tensor::from_array(([n], qtype.into_boxed_slice())).map_err(|e| e.to_string())?;

  let outputs = session
    .run(ort::inputs![
      "input_ids" => input_ids_tensor,
      "attention_mask" => attention_mask_tensor,
      "marker_pos" => marker_pos_tensor,
      "marker_mask" => marker_mask_tensor,
      "qtype" => qtype_tensor,
    ])
    .map_err(|e| format!("onnxruntime inference failed: {e}"))?;

  let (logits_shape, logits_data) = outputs["logits"]
    .try_extract_tensor::<f32>()
    .map_err(|e| e.to_string())?;
  let logits_kmax = logits_shape[1] as usize;

  let mut answers = Map::new();
  for (row, id) in ids.iter().enumerate() {
    let q = &questions[*id];
    let k = items[row].1.len();
    let row_logits = &logits_data[row * logits_kmax..row * logits_kmax + k];
    let bucket = temp_bucket(qtype_name(q), k);
    let t_scale = config
      .temperature_by_options
      .get(&bucket)
      .copied()
      .unwrap_or(config.temperature[qtype_index(q) as usize]);
    let scaled: Vec<f32> = row_logits.iter().map(|&v| v / t_scale).collect();
    let p = softmax(&scaled);
    let confidence = confidence_from_probs(&p, k);

    let answer = match q {
      QuestionDef::Choice { criteria, .. } => {
        let best = p
          .iter()
          .enumerate()
          .max_by(|a, b| a.1.total_cmp(b.1))
          .map(|(i, _)| i)
          .unwrap_or(0);
        let mut probs = Map::new();
        for (opt, prob) in criteria.iter().zip(p.iter()) {
          probs.insert(opt.key.clone(), json!(prob));
        }
        json!({
          "type": "choice",
          "choice": criteria[best].key,
          "probabilities": probs,
          "confidence": confidence,
        })
      }
      QuestionDef::Score { levels, .. } => {
        let exp_score: f64 = p.iter().enumerate().map(|(i, &v)| i as f64 * v as f64).sum();
        let mut probs = Map::new();
        for (i, prob) in p.iter().enumerate() {
          probs.insert(i.to_string(), json!(prob));
        }
        json!({
          "type": "score",
          "score": exp_score,
          "legend": levels,
          "probabilities": probs,
          "confidence": confidence,
        })
      }
      QuestionDef::Noul { .. } => {
        let noul = p.get(1).copied().unwrap_or(0.0);
        json!({
          "type": "noul",
          "noul": noul,
          "confidence": (noul as f64).max(1.0 - noul as f64),
        })
      }
    };
    answers.insert((*id).clone(), answer);
  }

  Ok(json!({ "model": "laya-multilingual", "answers": answers }))
}

#[cfg(test)]
mod tests {
  use super::*;

  /// End-to-end check against the real bundled resources (produced by
  /// scripts/fetch-onnxruntime.ps1 + scripts/export-laya-onnx.py) — not
  /// present in CI/a fresh clone, so this test skips itself rather than
  /// failing when the resources aren't there. Run manually after fetching
  /// them to verify the Rust pipeline matches the Python reference.
  #[test]
  fn department_billing_matches_python_reference() {
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let laya_dir = manifest_dir.join("resources").join("laya");
    let ort_name = if cfg!(windows) {
      "onnxruntime.dll"
    } else if cfg!(target_os = "macos") {
      "libonnxruntime.dylib"
    } else {
      "libonnxruntime.so"
    };
    let ort_dll = manifest_dir.join("resources").join("onnxruntime").join(ort_name);
    if !laya_dir.join("model.onnx").exists() || !ort_dll.exists() {
      eprintln!("skipping: laya/onnxruntime resources not present locally");
      return;
    }

    ort::init_from(ort_dll.to_string_lossy().to_string())
      .expect("load onnxruntime")
      .commit();

    let config: LayaConfig =
      serde_json::from_slice(&std::fs::read(laya_dir.join("laya_config.json")).unwrap()).unwrap();
    let tokenizer = Tokenizer::from_file(laya_dir.join("tokenizer").join("tokenizer.json")).unwrap();
    let mut session = Session::builder()
      .unwrap()
      .commit_from_file(laya_dir.join("model.onnx"))
      .unwrap();

    let mut questions = std::collections::BTreeMap::new();
    questions.insert(
      "department".to_string(),
      QuestionDef::Choice {
        instructions: "Which team should handle this?".to_string(),
        criteria: vec![
          ChoiceOption { key: "billing".to_string(), description: Some("invoices, refunds".to_string()) },
          ChoiceOption { key: "technical".to_string(), description: Some("bugs".to_string()) },
          ChoiceOption { key: "sales".to_string(), description: Some("pricing".to_string()) },
        ],
      },
    );
    questions.insert(
      "refund_requested".to_string(),
      QuestionDef::Noul {
        instructions: "Does the sender ask for a refund?".to_string(),
        true_description: None,
        false_description: None,
      },
    );

    let state_text = "Hi, we were billed twice for March, please refund us today.";
    let result = run_questions(&mut session, &tokenizer, &config, state_text, &questions).unwrap();

    let department = result["answers"]["department"]["choice"].as_str().unwrap();
    let confidence = result["answers"]["department"]["confidence"].as_f64().unwrap();
    println!("department={department} confidence={confidence}");
    assert_eq!(department, "billing");
    assert!(confidence > 0.5, "expected reasonably confident answer, got {confidence}");

    let noul = result["answers"]["refund_requested"]["noul"].as_f64().unwrap();
    println!("refund_requested noul={noul}");
    assert!(noul > 0.5, "expected the model to detect a refund request, got {noul}");
  }
}
