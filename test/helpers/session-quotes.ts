// Original tiny design: quoting is needed for both the net and layer names.
export const SESSION_QUOTE_DSN = `(pcb quotes
  (parser (string_quote ') (space_in_quoted_tokens on))
  (resolution um 1) (unit um)
  (structure (layer 'front (signal)' (type signal))
    (boundary (rect pcb 0 0 10000 10000))
    (rule (width 200) (clearance 200)))
  (network (net 'signal (A)'))
  (wiring (wire (path 'front (signal)' 200 1000 1000 2000 1000)
    (net 'signal (A)') (type protect))))`;

