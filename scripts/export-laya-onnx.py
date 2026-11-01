"""Dev-only, one-time export of the Laya multilingual decision model to ONNX.

Second Brain never requires Python on the end-user machine (same rule as the
llama.cpp/stable-diffusion.cpp sidecars). Python + torch + transformers are only
used here, on the dev machine, to trace the model once; the shipped app only
gets the resulting model.onnx + tokenizer files, driven by Rust + onnxruntime.

Usage (from a venv with `pip install laya torch transformers onnx onnxruntime numpy`):
    python scripts/export-laya-onnx.py

Downloads convaiinnovations/laya-multilingual (~650MB, cached by huggingface_hub),
traces DecisionModel.forward to ONNX, copies the tokenizer, and verifies the ONNX
output matches the original PyTorch output before writing anything into
src-tauri/resources/laya/.
"""
import json
import os

import numpy as np
import onnxruntime as ort
import torch

import laya
from laya.common import build_sequence, collate_items

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "src-tauri", "resources", "laya")


def main():
    print("Loading convaiinnovations/laya-multilingual ...")
    agent = laya.load("convaiinnovations/laya-multilingual")
    model = agent.model.eval()

    # Build a representative batch: 3 questions of different types/option counts,
    # so the traced graph sees varying marker counts (kmax) at export time.
    questions = {
        "department": {"t": "choice", "ins": "Which team should handle this?",
                       "crit": {"billing": "invoices, refunds", "technical": "bugs", "sales": "pricing"}},
        "urgency": {"t": "score", "ins": "How urgent is this?",
                    "crit": ["not urgent", "soon", "critical"]},
        "refund_requested": {"t": "noul", "ins": "Does the sender ask for a refund?", "crit": None},
    }
    from laya.common import QTYPES
    state = "Hi, we were billed twice for March, please refund us today."
    items = []
    for qid, q in questions.items():
        seq, markers = build_sequence(agent.tok, state, q, agent.cfg["max_len"], agent.cfg["head_max_len"])
        items.append({"ids": seq, "markers": markers, "qtype": QTYPES[q["t"]]})
    batch = collate_items([items], agent.tok.pad_token_id)

    args = (
        batch["input_ids"],
        batch["attention_mask"],
        batch["marker_pos"],
        batch["marker_mask"],
        batch["qtype"],
    )

    with torch.no_grad():
        ref_logits, ref_act = model(*args)

    os.makedirs(OUT_DIR, exist_ok=True)
    onnx_path = os.path.join(OUT_DIR, "model.onnx")
    print("Exporting to", onnx_path)
    torch.onnx.export(
        model,
        args,
        onnx_path,
        input_names=["input_ids", "attention_mask", "marker_pos", "marker_mask", "qtype"],
        output_names=["logits", "act_logits"],
        dynamic_axes={
            "input_ids": {0: "n", 1: "seq"},
            "attention_mask": {0: "n", 1: "seq"},
            "marker_pos": {0: "n", 1: "kmax"},
            "marker_mask": {0: "n", 1: "kmax"},
            "qtype": {0: "n"},
            "logits": {0: "n", 1: "kmax"},
            "act_logits": {0: "n"},
        },
        opset_version=18,
    )

    print("Verifying ONNX output against PyTorch reference ...")
    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    onnx_out = sess.run(
        None,
        {
            "input_ids": batch["input_ids"].numpy(),
            "attention_mask": batch["attention_mask"].numpy(),
            "marker_pos": batch["marker_pos"].numpy(),
            "marker_mask": batch["marker_mask"].numpy(),
            "qtype": batch["qtype"].numpy(),
        },
    )
    logits_diff = np.abs(onnx_out[0] - ref_logits.numpy()).max()
    act_diff = np.abs(onnx_out[1] - ref_act.numpy()).max()
    print(f"max abs diff (fp32): logits={logits_diff:.6g} act={act_diff:.6g}")
    if logits_diff > 1e-2 or act_diff > 1e-2:
        raise SystemExit("ONNX output diverges from PyTorch reference — do not ship this export.")

    # Copy tokenizer + the small set of config values Rust needs (no PyTorch/JSON
    # training internals) into the resource bundle.
    tok_src = agent.tok.save_pretrained(os.path.join(OUT_DIR, "tokenizer"))
    laya_config = {
        "max_len": agent.cfg["max_len"],
        "head_max_len": agent.cfg["head_max_len"],
        "temperature": agent.temperature,
        "temperature_by_options": agent.temperature_by_options,
        "mask_token": agent.tok.mask_token,
        "mask_token_id": agent.tok.mask_token_id,
        "cls_token_id": agent.tok.cls_token_id,
        "sep_token_id": agent.tok.sep_token_id,
        "pad_token_id": agent.tok.pad_token_id,
    }
    with open(os.path.join(OUT_DIR, "laya_config.json"), "w") as f:
        json.dump(laya_config, f, indent=2)

    print("Done. Wrote:", os.listdir(OUT_DIR))


if __name__ == "__main__":
    main()
