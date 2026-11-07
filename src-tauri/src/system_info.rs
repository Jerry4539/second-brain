use serde::Serialize;
use std::process::Command;

#[derive(Serialize, Clone, Debug)]
pub struct SystemSpecs {
  pub os: String,
  pub arch: String,
  pub cpu_brand: String,
  pub cpu_cores: usize,
  pub total_ram_gb: f64,
  pub is_apple_silicon: bool,
  pub has_metal: bool,
  pub acceleration: String,
  pub recommended_tier: String,
  pub optimal_threads: i32,
}

fn detect_cpu_brand() -> String {
  #[cfg(target_os = "macos")]
  {
    if let Ok(out) = Command::new("sysctl")
      .args(["-n", "machdep.cpu.brand_string"])
      .output()
    {
      let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
      if !s.is_empty() {
        return s;
      }
    }
  }

  #[cfg(target_os = "windows")]
  {
    if let Ok(val) = std::env::var("PROCESSOR_IDENTIFIER") {
      if !val.trim().is_empty() {
        return val.trim().to_string();
      }
    }
  }

  #[cfg(target_os = "linux")]
  {
    if let Ok(cpuinfo) = std::fs::read_to_string("/proc/cpuinfo") {
      for line in cpuinfo.lines() {
        if let Some(rest) = line.strip_prefix("model name") {
          if let Some((_, name)) = rest.split_once(':') {
            return name.trim().to_string();
          }
        }
      }
    }
  }

  if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
    "Apple Silicon".to_string()
  } else {
    format!("{} Processor", std::env::consts::ARCH)
  }
}

fn detect_total_ram_gb() -> f64 {
  #[cfg(target_os = "macos")]
  {
    if let Ok(out) = Command::new("sysctl").args(["-n", "hw.memsize"]).output() {
      if let Ok(bytes) = String::from_utf8_lossy(&out.stdout).trim().parse::<u64>() {
        let gb = (bytes as f64) / (1024.0 * 1024.0 * 1024.0);
        return (gb * 10.0).round() / 10.0;
      }
    }
  }

  #[cfg(target_os = "linux")]
  {
    if let Ok(meminfo) = std::fs::read_to_string("/proc/meminfo") {
      for line in meminfo.lines() {
        if let Some(rest) = line.strip_prefix("MemTotal:") {
          let kb_str = rest.trim().trim_end_matches("kB").trim();
          if let Ok(kb) = kb_str.parse::<u64>() {
            let gb = (kb as f64) / (1024.0 * 1024.0);
            return (gb * 10.0).round() / 10.0;
          }
        }
      }
    }
  }

  #[cfg(target_os = "windows")]
  {
    let mut cmd = Command::new("powershell");
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000);
    if let Ok(out) = cmd
      .args([
        "-NoProfile",
        "-Command",
        "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
      ])
      .output()
    {
      if let Ok(bytes) = String::from_utf8_lossy(&out.stdout).trim().parse::<u64>() {
        let gb = (bytes as f64) / (1024.0 * 1024.0 * 1024.0);
        return (gb * 10.0).round() / 10.0;
      }
    }
  }

  8.0
}

pub fn compute_optimal_threads(cpu_cores: usize, is_apple_silicon: bool) -> i32 {
  if is_apple_silicon {
    // On Apple Silicon (M1/M2/M3/M4), Metal GPU handles the heavy matrix math while
    // performance cores handle dispatch/sampling. Using 4–6 threads matches the P-core
    // count without waking E-cores or causing thermal throttling.
    (cpu_cores as i32 / 2).clamp(4, 6)
  } else {
    // On hybrid x86 CPUs (Intel P+E cores / AMD), clamp to 2..=4 threads to stay cool and silent.
    (cpu_cores as i32 / 2).clamp(2, 4)
  }
}

#[tauri::command]
pub fn get_system_specs() -> SystemSpecs {
  let os = std::env::consts::OS.to_string();
  let arch = std::env::consts::ARCH.to_string();
  let is_apple_silicon = cfg!(all(target_os = "macos", target_arch = "aarch64"));
  let has_metal = is_apple_silicon || cfg!(target_os = "macos");
  let cpu_cores = std::thread::available_parallelism()
    .map(|n| n.get())
    .unwrap_or(4);
  let cpu_brand = detect_cpu_brand();
  let total_ram_gb = detect_total_ram_gb();
  let optimal_threads = compute_optimal_threads(cpu_cores, is_apple_silicon);

  let acceleration = if is_apple_silicon {
    "Apple Metal GPU + Unified Memory".to_string()
  } else if cfg!(target_os = "macos") {
    "macOS Accelerate + Metal".to_string()
  } else {
    "AVX2 Multi-Core CPU".to_string()
  };

  let recommended_tier = if total_ram_gb < 8.0 {
    "nano".to_string()
  } else if is_apple_silicon || total_ram_gb >= 14.0 {
    "pro".to_string()
  } else {
    "compact".to_string()
  };

  SystemSpecs {
    os,
    arch,
    cpu_brand,
    cpu_cores,
    total_ram_gb,
    is_apple_silicon,
    has_metal,
    acceleration,
    recommended_tier,
    optimal_threads,
  }
}

