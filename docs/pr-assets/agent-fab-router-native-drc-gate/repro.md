# Reproduction

On the measured host, the original invocation was:

```bash
cd /home/hyper/bench/wt/fr-bugs
taskset -c 20-25 nice -n 10 timeout 3600 python3 /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c189/measure.py
```

`measured-invocation.py` retains the exact script bytes for that run, including its source
suite and output paths. `measure.py` is a parameterized equivalent for fresh output paths:

```bash
cd /home/hyper/bench/wt/fr-bugs
bun run typecheck && bun run check:layers && bun run test
python3 docs/pr-assets/agent-fab-router-native-drc-gate/measure.py \
  --prior /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c188/final-run \
  --source "$PWD" --out /tmp/native-gate-repeat
python3 docs/pr-assets/agent-fab-router-native-drc-gate/verify.py /tmp/native-gate-repeat
```

To regenerate the prerequisite candidates instead of using the retained suite, run:

```bash
cd /home/hyper/bench/wt/fp-bugs
taskset -c 20-25 nice -n 10 python3 benchmarks/autorouter/benchmark.py \
  --router fab-router --fab-router-source /home/hyper/bench/wt/fr-bugs \
  --out /home/hyper/bench/agents/codex-fabpcb-bugs/scratch/c189/fresh-router-suite
```

Use that fresh output as `--prior`. It must contain 26 cases × 3 seeds. KiCad CLI 10.0.6,
Bun 1.4.0 and the benchmark's normal native dependencies were used. The frozen inputs,
checker, scoring, adapter, engine routing and shared runtime were unchanged. The measured
run rechecks retained routed candidates; it does not execute the router again.
