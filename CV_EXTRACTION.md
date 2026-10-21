# CV extraction and content decisions

The content was extracted from supplied CV PDFs only. Cover letters and target-employer labels were not used as evidence of employment or capability. Public copy is a faithful English translation; exact organizations, degree status and project names are retained.

## Sources

| Source | Use |
| --- | --- |
| `cv_Rida_Faradi_automobile.pdf` | Primary source: identity, profile, UTAC, four projects, skills, languages and activities. Public CV download. |
| `CV_Rida_Faradi_PFE.pdf` | Corroborates the primary CV and clarifies SAFETYBRAIN’s master/slave architecture and embedded REST server. |
| `CV_Rida_Faradi_maroc_format.pdf` | Adds the explicitly documented OCP introductory internship, July–August 2025. |

The automobile, PFE, Maroc, Stellantis, UTAC and AVL CV variants were compared. The shared UTAC/project/skills account is consistent. Stellantis and AVL appear as application targets, not employers. Every node and edge stores a source ID, page/section locator and supporting evidence; source files have SHA-256 checksums. Raw extracted texts are kept in the private task workspace, outside the site.

## Extracted summary

| Category | Verified content |
| --- | --- |
| Profile | Rida Faradi; electrical and embedded engineering student; seeking a 2027 PFE internship. |
| Education | State engineering degree in electrical engineering, embedded systems, at ENSA Khouribga; 2022–present, in progress. No completed engineering degree is claimed. |
| Latest experience | UTAC Maroc, PFA internship, July–August 2026, Oued Zem: automotive test preparation; ADAS BSD/RVC/DMS; CAN/LIN analysis with CANalyzer; technical documentation. |
| Earlier experience | OCP Group, Khouribga industrial site, introductory internship, July–August 2025: observed HV/MV substation organization and operation; studied its single-line diagram. This is not presented as autonomous HV design or maintenance responsibility. |
| Projects | Calandre active (AGS); BMS battery SOH prediction; SAFETYBRAIN STATION; Mini-usine intelligente (team project, 2025–2026). |
| Core technologies | CANalyzer, C/C++, Python, Arduino, ESP32, Raspberry Pi 4, STM32, PIC, UART, I2C, JSON, HTTP, REST, FastAPI, WebSocket, ADS1115, XGBoost, Streamlit, MATLAB, LabVIEW, Proteus, VHDL/FPGA, Arduino IDE. No proficiency scores. |
| Languages | Arabic: native; French and English: fluent, as stated in the CV. |
| Activities | ElectroDays 9.0 event vice-president, 2025–2026; ENSA Club Sportif logistics and travel, September 2024–June 2025. These are association roles, not company employment. |
| Contact | faradirida1@gmail.com; +212 649 781 159; LinkedIn URI verified from the primary CV’s hyperlink annotation. |
| Certifications / GitHub | Not present in the supplied CVs; no certification nodes or GitHub link are asserted. |

## Decisions and missing fields

- Four editorial clusters summarize supported work: Automotive & validation; Electrical & power; Embedded & electronics; Software & data. They are navigation groups, not extra qualifications.
- Project outcome metrics, accuracy, deployment results and missing dates remain unasserted. AGS, BMS and SAFETYBRAIN date labels are null; project URLs are omitted. OCP’s observed role is kept narrower than a professional electrical design role.
- The CV’s SAFETYBRAIN response-time claim (<50 ms) is not used in public copy because the measurement conditions are not supplied. No new metric was calculated or invented.
- LTSpice and EMC learning interests in a tailored CV are not promoted into demonstrated skills. CANoe, AUTOSAR, ISO 26262, named certifications and a GitHub profile are not asserted.
- No projects are linked to ENSA with `PRODUCED` or `LEARNED_AT` unless the CV explicitly states that relationship. The Person-to-Project `PRODUCED` relation means contributed to that listed project; cards preserve the team/contribution wording.
- Relations use only the brief’s five types. `RELATED_TO` connects the person to documented organizations/activities/contact nodes without asserting an unlisted contractual relationship. Edge weight is editorial visual emphasis, not proficiency or measured importance.
- `details.visualization` is a UI instruction. All generated waveforms, CAN streams and curves must be visibly labeled illustrative; they are not measured project results.
- The `placeholders` array records optional missing fields and these limitations. It does not introduce unverified public nodes. All published nodes have `status: "verified"` against a supplied CV source.
- Certifications are omitted from the tour because none are stated. The contact tour stop includes email, LinkedIn and phone, while `profile.cvDownloadUrl` supplies the selected CV.

## Graph inventory

| Type | Count |
| --- | ---: |
| Person | 1 |
| Project | 4 |
| Skill | 12 |
| Technology | 23 |
| Experience | 4 |
| Education | 1 |
| Certification | 0 |
| Contact | 3 |

Total: 48 nodes, 77 source-backed edges, four clusters and six tour stops.

## Editing contract

Edit `data/graph.json`; keep node IDs stable and add CV evidence for every new fact. `data/graph.schema.json` documents fields. `profile` controls the introduction and CV download; node `details` drives cards and Classic content; `stackNodeIds` and edges reference existing nodes. Validate source/node/cluster references, unique IDs, safe links and degree status before building. Source evidence is for authoring/auditing and should not be displayed as raw passages in the diagnostic UI.
