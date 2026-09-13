# `src/ses` — session files

`write.ts` emits the SPECCTRA session (`spec/formats/ses.md`): `placement` from the Parts,
`library_out` for the PadForms used by written Barrels, `network_out` wires and vias with integer
coordinates in resolution units; `apply.ts` reads a session's `routes/network_out` back onto a
Layout so `writeSes` → `applySes` reproduces Track and Barrel counts and DRC statistics. From the
SPECCTRA Design Language Reference (Cadence 2003) only. Task I2 implements.
