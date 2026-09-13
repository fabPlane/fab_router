# `src/srj` — SimpleRouteJson adapter

Converts the public tscircuit SimpleRouteJson format (`spec/types/srj.ts`, millimetre units) into a
Layout through the mapping in `spec/formats/srj.md`, runs the pipeline, writes the result back as
`pcb_trace` elements with `wire` and `via` steps, and measures differential-pair lengths and skew.
Task I6 implements.
