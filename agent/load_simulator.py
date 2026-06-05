import argparse
import math
import multiprocessing
import os
import random
import socket
import tempfile
import threading
import time
from urllib.request import urlopen


def cpu_worker(
    stop_event,
    cpu_min: float,
    cpu_max: float,
    phase: float,
    seed: int,
) -> None:
    random.seed(seed)
    period = 0.2
    started = time.time()
    while not stop_event.is_set():
        elapsed = time.time() - started
        wave = (math.sin(elapsed / 9 + phase) + 1) / 2
        jitter = random.uniform(-0.04, 0.04)
        duty = max(0.0, min(0.98, cpu_min + (cpu_max - cpu_min) * wave + jitter))
        busy_until = time.perf_counter() + period * duty
        while time.perf_counter() < busy_until:
            math.sqrt(random.random() * 10000)
        time.sleep(period * (1 - duty))


def memory_worker(stop_event: threading.Event, min_mb: int, max_mb: int, seed: int) -> None:
    random.seed(seed)
    chunks: list[bytearray] = []
    while not stop_event.is_set():
        target_mb = random.randint(min_mb, max_mb)
        current_mb = len(chunks) * 8
        while current_mb < target_mb:
            chunks.append(bytearray(8 * 1024 * 1024))
            current_mb += 8
        while current_mb > target_mb and chunks:
            chunks.pop()
            current_mb -= 8
        time.sleep(8)


def disk_worker(stop_event: threading.Event, write_mb: int, interval: float) -> None:
    path = os.path.join(tempfile.gettempdir(), "cloud-monitor-load.tmp")
    block = os.urandom(1024 * 1024)
    while not stop_event.is_set():
        with open(path, "wb") as handle:
            for _ in range(write_mb):
                handle.write(block)
            handle.flush()
            os.fsync(handle.fileno())
        with open(path, "rb") as handle:
            while handle.read(1024 * 1024):
                pass
        try:
            os.remove(path)
        except OSError:
            pass
        time.sleep(interval)


def network_worker(stop_event: threading.Event, url: str, interval: float) -> None:
    while not stop_event.is_set():
        try:
            with urlopen(url, timeout=5) as response:
                while response.read(256 * 1024):
                    pass
        except Exception:
            pass
        time.sleep(interval)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate light, repeatable load for cloud monitor demo.")
    parser.add_argument("--cpu-min", type=float, default=0.10, help="minimum CPU duty per worker, 0-1")
    parser.add_argument("--cpu-max", type=float, default=0.45, help="maximum CPU duty per worker, 0-1")
    parser.add_argument("--workers", type=int, default=1, help="CPU worker count")
    parser.add_argument("--memory-min-mb", type=int, default=64)
    parser.add_argument("--memory-max-mb", type=int, default=256)
    parser.add_argument("--disk-write-mb", type=int, default=16)
    parser.add_argument("--disk-interval", type=float, default=1.5)
    parser.add_argument("--network-url", default="")
    parser.add_argument("--network-interval", type=float, default=1.5)
    args = parser.parse_args()

    seed = sum(ord(ch) for ch in socket.gethostname())
    random.seed(seed)
    phase = random.random() * math.pi * 2
    stop_event = multiprocessing.Event()

    cpu_processes: list[multiprocessing.Process] = []
    threads: list[threading.Thread] = []
    for index in range(max(1, args.workers)):
        cpu_processes.append(
            multiprocessing.Process(
                target=cpu_worker,
                args=(stop_event, args.cpu_min, args.cpu_max, phase + index * 0.75, seed + index + 1),
                daemon=True,
            )
        )
    threads.append(threading.Thread(target=memory_worker, args=(stop_event, args.memory_min_mb, args.memory_max_mb, seed), daemon=True))
    threads.append(threading.Thread(target=disk_worker, args=(stop_event, args.disk_write_mb, args.disk_interval), daemon=True))
    if args.network_url:
        threads.append(threading.Thread(target=network_worker, args=(stop_event, args.network_url, args.network_interval), daemon=True))

    print(
        f"load simulator started on {socket.gethostname()} "
        f"cpu={args.cpu_min:.0%}-{args.cpu_max:.0%}, memory={args.memory_min_mb}-{args.memory_max_mb}MB, "
        f"disk={args.disk_write_mb}MB/{args.disk_interval}s, network={args.network_url or 'disabled'}"
    )
    for process in cpu_processes:
        process.start()
    for thread in threads:
        thread.start()

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        stop_event.set()
        for process in cpu_processes:
            process.join(timeout=2)
            if process.is_alive():
                process.terminate()
        print("load simulator stopped")


if __name__ == "__main__":
    main()
