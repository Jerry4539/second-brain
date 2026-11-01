use serde::Serialize;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

#[derive(Serialize)]
pub struct GgufImportInfo {
  pub name: String,
  pub size_bytes: u64,
  pub architecture: Option<String>,
  pub quantization: Option<String>,
  pub context_length: Option<u64>,
  pub estimated_ram_bytes: u64,
}

enum GgufValue {
  Scalar(ScalarValue),
  Array,
}

#[allow(dead_code)] // Float/Bool metadata values are parsed (to advance the reader) but unused today.
enum ScalarValue {
  UInt(u64),
  Int(i64),
  Float(f64),
  Bool(bool),
  Str(String),
}

/// Minimal GGUF header/metadata reader — reads just enough to surface useful info
/// for the model manager (architecture, quantization, context length). Never
/// touches the tensor data itself.
struct GgufReader<R: Read> {
  inner: BufReader<R>,
}

impl<R: Read> GgufReader<R> {
  fn new(inner: R) -> Self {
    Self {
      inner: BufReader::new(inner),
    }
  }

  fn read_bytes(&mut self, len: usize) -> Result<Vec<u8>, String> {
    let mut buf = vec![0u8; len];
    self
      .inner
      .read_exact(&mut buf)
      .map_err(|e| format!("failed to read GGUF file: {e}"))?;
    Ok(buf)
  }

  fn read_u32(&mut self) -> Result<u32, String> {
    let b = self.read_bytes(4)?;
    Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
  }

  fn read_u64(&mut self) -> Result<u64, String> {
    let b = self.read_bytes(8)?;
    Ok(u64::from_le_bytes(b.try_into().unwrap()))
  }

  fn read_i64(&mut self) -> Result<i64, String> {
    Ok(self.read_u64()? as i64)
  }

  fn read_f32(&mut self) -> Result<f32, String> {
    let b = self.read_bytes(4)?;
    Ok(f32::from_le_bytes(b.try_into().unwrap()))
  }

  fn read_f64(&mut self) -> Result<f64, String> {
    let b = self.read_bytes(8)?;
    Ok(f64::from_le_bytes(b.try_into().unwrap()))
  }

  fn read_string(&mut self) -> Result<String, String> {
    let len = self.read_u64()? as usize;
    let bytes = self.read_bytes(len)?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
  }

  /// Reads one value of the given GGUF type, skipping array contents we don't need.
  fn read_value(&mut self, value_type: u32) -> Result<GgufValue, String> {
    let scalar = match value_type {
      0 => ScalarValue::UInt(self.read_bytes(1)?[0] as u64), // UINT8
      1 => ScalarValue::Int(self.read_bytes(1)?[0] as i64),  // INT8
      2 => ScalarValue::UInt(u16::from_le_bytes(self.read_bytes(2)?.try_into().unwrap()) as u64), // UINT16
      3 => ScalarValue::Int(i16::from_le_bytes(self.read_bytes(2)?.try_into().unwrap()) as i64), // INT16
      4 => ScalarValue::UInt(self.read_u32()? as u64), // UINT32
      5 => ScalarValue::Int(self.read_u32()? as i64),  // INT32
      6 => ScalarValue::Float(self.read_f32()? as f64), // FLOAT32
      7 => ScalarValue::Bool(self.read_bytes(1)?[0] != 0), // BOOL
      8 => ScalarValue::Str(self.read_string()?),       // STRING
      9 => {
        // ARRAY: element type + count, then that many elements — skip contents.
        let elem_type = self.read_u32()?;
        let count = self.read_u64()?;
        for _ in 0..count {
          self.read_value(elem_type)?;
        }
        return Ok(GgufValue::Array);
      }
      10 => ScalarValue::UInt(self.read_u64()?), // UINT64
      11 => ScalarValue::Int(self.read_i64()?),  // INT64
      12 => ScalarValue::Float(self.read_f64()?), // FLOAT64
      other => return Err(format!("unknown GGUF value type: {other}")),
    };
    Ok(GgufValue::Scalar(scalar))
  }
}

const KNOWN_FILE_TYPES: &[(u32, &str)] = &[
  (0, "F32"),
  (1, "F16"),
  (2, "Q4_0"),
  (3, "Q4_1"),
  (7, "Q8_0"),
  (8, "Q5_0"),
  (9, "Q5_1"),
  (10, "Q2_K"),
  (11, "Q3_K_S"),
  (12, "Q3_K_M"),
  (13, "Q3_K_L"),
  (14, "Q4_K_S"),
  (15, "Q4_K_M"),
  (16, "Q5_K_S"),
  (17, "Q5_K_M"),
  (18, "Q6_K"),
  (19, "IQ2_XXS"),
  (20, "IQ2_XS"),
  (21, "Q2_K_S"),
  (22, "IQ3_XS"),
  (23, "IQ3_XXS"),
  (24, "IQ1_S"),
  (25, "IQ4_NL"),
  (26, "IQ3_S"),
  (27, "IQ3_M"),
  (28, "IQ2_S"),
  (29, "IQ2_M"),
  (30, "IQ4_XS"),
  (31, "IQ1_M"),
  (32, "BF16"),
  (33, "TQ1_0"),
  (34, "TQ2_0"),
];

const KNOWN_QUANT_TOKENS: &[&str] = &[
  "IQ1_S", "IQ1_M", "IQ2_XXS", "IQ2_XS", "IQ2_S", "IQ2_M", "IQ3_XXS", "IQ3_XS", "IQ3_S", "IQ3_M",
  "IQ4_XS", "IQ4_NL", "Q2_K_S", "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_K_S", "Q4_K_M", "Q5_K_S",
  "Q5_K_M", "Q6_K", "Q4_0", "Q4_1", "Q5_0", "Q5_1", "Q8_0", "BF16", "F16", "F32",
];

fn guess_quant_from_filename(filename: &str) -> Option<String> {
  let upper = filename.to_uppercase();
  KNOWN_QUANT_TOKENS
    .iter()
    .find(|token| upper.contains(*token))
    .map(|s| s.to_string())
}

fn title_case_from_filename(stem: &str) -> String {
  stem
    .replace(['-', '_'], " ")
    .split_whitespace()
    .map(|word| {
      let mut chars = word.chars();
      match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
      }
    })
    .collect::<Vec<_>>()
    .join(" ")
}

pub fn read_gguf_info(path: &Path) -> Result<GgufImportInfo, String> {
  let file = File::open(path).map_err(|e| format!("failed to open file: {e}"))?;
  let size_bytes = file
    .metadata()
    .map_err(|e| format!("failed to read file metadata: {e}"))?
    .len();

  let mut reader = GgufReader::new(file);

  let magic = reader.read_bytes(4)?;
  if magic != *b"GGUF" {
    return Err("not a valid GGUF file (missing magic header)".to_string());
  }
  let version = reader.read_u32()?;
  let _tensor_count = reader.read_u64()?;
  let kv_count = reader.read_u64()?;

  if version < 2 {
    return Err("unsupported GGUF version (only v2+ is supported)".to_string());
  }

  let mut architecture: Option<String> = None;
  let mut name: Option<String> = None;
  let mut file_type: Option<u32> = None;
  let mut size_label: Option<String> = None;
  let mut context_length: Option<u64> = None;

  for _ in 0..kv_count {
    let key = reader.read_string()?;
    let value_type = reader.read_u32()?;
    let value = reader.read_value(value_type)?;

    if let GgufValue::Scalar(scalar) = value {
      match key.as_str() {
        "general.architecture" => {
          if let ScalarValue::Str(s) = scalar {
            architecture = Some(s);
          }
        }
        "general.name" => {
          if let ScalarValue::Str(s) = scalar {
            name = Some(s);
          }
        }
        "general.size_label" => {
          if let ScalarValue::Str(s) = scalar {
            size_label = Some(s);
          }
        }
        "general.file_type" => {
          file_type = match scalar {
            ScalarValue::UInt(v) => Some(v as u32),
            ScalarValue::Int(v) => Some(v as u32),
            _ => None,
          };
        }
        k if k.ends_with(".context_length") => {
          context_length = match scalar {
            ScalarValue::UInt(v) => Some(v),
            ScalarValue::Int(v) => Some(v as u64),
            _ => None,
          };
        }
        _ => {}
      }
    }
  }

  let filename = path
    .file_stem()
    .and_then(|s| s.to_str())
    .unwrap_or("model");

  let quantization = file_type
    .and_then(|ft| KNOWN_FILE_TYPES.iter().find(|(id, _)| *id == ft))
    .map(|(_, label)| label.to_string())
    .or_else(|| guess_quant_from_filename(filename));

  let mut display_name = name.unwrap_or_else(|| title_case_from_filename(filename));
  if let Some(label) = &size_label {
    if !display_name.to_lowercase().contains(&label.to_lowercase()) {
      display_name = format!("{display_name} {label}");
    }
  }

  let architecture = architecture.map(|a| {
    let mut chars = a.chars();
    match chars.next() {
      Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
      None => a,
    }
  });

  // Rough rule of thumb: runtime (context/KV cache + overhead) adds ~15% on top
  // of the on-disk quantized weight size for typical context sizes.
  let estimated_ram_bytes = (size_bytes as f64 * 1.15) as u64;

  Ok(GgufImportInfo {
    name: display_name,
    size_bytes,
    architecture,
    quantization,
    context_length,
    estimated_ram_bytes,
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Write;

  /// Builds a minimal-but-valid GGUF v3 byte stream with a handful of metadata
  /// entries (architecture, name, file_type, context_length, an array key to
  /// prove skipping works) so the parser can be tested without a real model.
  fn build_fake_gguf() -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(b"GGUF");
    buf.extend_from_slice(&3u32.to_le_bytes()); // version
    buf.extend_from_slice(&0u64.to_le_bytes()); // tensor_count
    buf.extend_from_slice(&5u64.to_le_bytes()); // metadata_kv_count

    fn write_string(buf: &mut Vec<u8>, s: &str) {
      buf.extend_from_slice(&(s.len() as u64).to_le_bytes());
      buf.extend_from_slice(s.as_bytes());
    }

    // general.architecture = "llama" (STRING = type 8)
    write_string(&mut buf, "general.architecture");
    buf.extend_from_slice(&8u32.to_le_bytes());
    write_string(&mut buf, "llama");

    // general.name = "TinyTest" (STRING)
    write_string(&mut buf, "general.name");
    buf.extend_from_slice(&8u32.to_le_bytes());
    write_string(&mut buf, "TinyTest");

    // general.file_type = 15 (Q4_K_M) (UINT32 = type 4)
    write_string(&mut buf, "general.file_type");
    buf.extend_from_slice(&4u32.to_le_bytes());
    buf.extend_from_slice(&15u32.to_le_bytes());

    // llama.context_length = 4096 (UINT32)
    write_string(&mut buf, "llama.context_length");
    buf.extend_from_slice(&4u32.to_le_bytes());
    buf.extend_from_slice(&4096u32.to_le_bytes());

    // llama.rope.dimensions = ARRAY of 3 UINT32 (type 9) — must be skippable
    write_string(&mut buf, "llama.rope.dimensions");
    buf.extend_from_slice(&9u32.to_le_bytes()); // ARRAY
    buf.extend_from_slice(&4u32.to_le_bytes()); // element type = UINT32
    buf.extend_from_slice(&3u64.to_le_bytes()); // element count
    buf.extend_from_slice(&1u32.to_le_bytes());
    buf.extend_from_slice(&2u32.to_le_bytes());
    buf.extend_from_slice(&3u32.to_le_bytes());

    buf
  }

  #[test]
  fn parses_fake_gguf_metadata() {
    let dir = std::env::temp_dir();
    let path = dir.join("second_brain_test_model.gguf");
    {
      let mut file = File::create(&path).unwrap();
      file.write_all(&build_fake_gguf()).unwrap();
    }

    let info = read_gguf_info(&path).expect("should parse fake GGUF file");

    assert_eq!(info.architecture.as_deref(), Some("Llama"));
    assert_eq!(info.name, "TinyTest");
    assert_eq!(info.quantization.as_deref(), Some("Q4_K_M"));
    assert_eq!(info.context_length, Some(4096));
    assert!(info.size_bytes > 0);
    assert!(info.estimated_ram_bytes >= info.size_bytes);

    std::fs::remove_file(&path).ok();
  }

  #[test]
  fn rejects_non_gguf_file() {
    let dir = std::env::temp_dir();
    let path = dir.join("second_brain_test_not_gguf.bin");
    {
      let mut file = File::create(&path).unwrap();
      file.write_all(b"not a gguf file").unwrap();
    }

    let result = read_gguf_info(&path);
    assert!(result.is_err());

    std::fs::remove_file(&path).ok();
  }

  #[test]
  fn parses_real_smollm2_model() {
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let path = manifest_dir.join("test-model").join("SmolLM2-135M-Instruct-Q4_K_M.gguf");
    if !path.exists() {
      eprintln!("skipping: real test model not present");
      return;
    }

    let start = std::time::Instant::now();
    let info = read_gguf_info(&path).expect("should parse real GGUF file");
    println!("Parsed in {:?}: name={}, arch={:?}, quant={:?}, ctx={:?}", start.elapsed(), info.name, info.architecture, info.quantization, info.context_length);
    assert_eq!(info.quantization.as_deref(), Some("Q4_K_M"));
  }

  #[test]
  fn parses_user_qwen_model() {
    let path = std::path::PathBuf::from(r"C:\Users\Akash S\Downloads\qwen3-4b-q4_k_m-00001-of-00003.gguf");
    if !path.exists() {
      eprintln!("skipping: user qwen model not present");
      return;
    }

    match read_gguf_info(&path) {
      Ok(info) => {
        println!("Successfully parsed user model: name={}, arch={:?}, quant={:?}", info.name, info.architecture, info.quantization);
      }
      Err(e) => {
        panic!("FAILED to parse user model: {e}");
      }
    }
  }
}
