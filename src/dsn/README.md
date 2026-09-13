# `src/dsn` — SPECCTRA design files and rules files

Reader and writer for the DSN format as specified in `spec/formats/dsn.md` (lexical rules F-1…F-14
tested by the lexeme vectors; scopes; shapes; pad placement geometry; the document model of §13),
the exporter dialects of `spec/formats/dsn-dialects.md`, padstack name normalisation
(`spec/formats/padstack-names.md`), the rules-file overlay (`spec/formats/rules.md`), and the
Layout builder that turns a `DsnDocument` into a `Layout` (Frame, pad instantiation with rotation
and side, spacing table from rules / classes / pair types, subnets, plane Sheets). Written from the
published SPECCTRA Design Language Reference (Cadence, v10.1, 2003) and the corpus observations
in the spec — nothing else. Task I1 implements; this task fixes the internal parse-summary surface
the acceptance runner uses.
