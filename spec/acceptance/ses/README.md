# Unrouted session expectations

One file per readable board in `spec/acceptance/boards/`, named `<board file>.unrouted.sexp.json`
(the only board without a file is the one that is not a design file, `dsn-dialects.md` D-1):

```json
{ "_generated": "...", "board": "<board file>", "tree": [ "session", "...", ... ] }
```

`tree` is the canonical tree (`spec/formats/ses.md` F-S50) of the session that `writeSes` must
produce for the board as read by `readDsn(text, { name: "<board file>" })` with the default
options (file wiring included): the `ses-roundtrip` case normalises the router's output the same
way and requires deep equality (F-S51). How the expectations relate to the sessions the reference
implementations write is recorded in F-S52.
