"""Generate ReelOS's evidence-led technical whitepaper.

The paper separates verified implementation, prototype behavior, and research
direction. It never turns a unit test into hardware certification or credits
generative tools as project authors.
"""

from __future__ import annotations

import argparse
import html
import os
import zipfile
import xml.sax.saxutils as saxutils
from pathlib import Path


TITLE = "ReelOS: A Personal World of Cinema and Books"
SUBTITLE = "How source truth, graceful degradation, and private intelligence can make modest hardware feel extraordinary"
AUTHOR = "Austin Turner | Technical whitepaper working draft | September 2026"

SECTIONS = [
    ("Executive abstract", [
        "ReelOS is a local-first household media experience built around a deceptively hard promise: people should be able to choose, watch, read, and share without becoming administrators of their own home. The project attacks the recurring cost of conventional media systems—duplicated services, unnecessary conversion, brittle automation, unclear availability, and interfaces designed around machinery rather than people.",
        "Its central move is not to pretend computation is free. ReelOS tries to avoid expensive work before optimizing it: direct-play compatible streams, adapt only the incompatible layer when possible, keep buffers bounded, defer background work, and make every capability prove its source. Private machine learning is reserved for tasks where measured prediction improves the experience; deterministic rules retain control of permissions, source access, child boundaries, and destructive operations.",
        "This is an evidence-led working paper, not a certification. Repository tests demonstrate contracts and failure behavior. Physical playback quality, resource use, network behavior, installation, rollback, and model quality require separate measurements on the target appliance and clients.",
    ]),
    ("1. The experience problem is a systems problem", [
        "A beautiful interface cannot rescue a system that invents readiness, loses a profile's preferences, or exposes infrastructure failures as user chores. ReelOS therefore treats identity, taste, availability, progress, and capability evidence as shared contracts. The same profile state drives onboarding, Home, Discover, Books, Family, and Settings.",
        "The visual language—artwork, a profile-colored breathing atmosphere, quiet transparency, and intentional motion—is not decoration pasted over a server dashboard. It is the feedback layer for a personal system. Switching profiles changes recommendations and atmosphere; disabling motion or transparency changes presentation without changing meaning.",
    ]),
    ("2. Source truth before recommendation", [
        "Discovery and access are different facts. ReelOS may identify a commercial title while running in public-domain and personal-library mode, but the title does not become playable, requestable, or savable merely because metadata exists. A provider must be enabled and validated, or a verified personal or public-domain source must exist.",
        "Disabling a provider cancels provider work and removes inaccessible projections from visible collections without deleting independently owned files. Unknown metadata remains unknown. Missing media returns an unavailable response. No sample video is substituted for an arbitrary title.",
        "TorBox support is optional. Credentials are validated and kept out of browser state, public APIs, support bundles, and ordinary exports. Indexer support remains a deployment acceptance item until every configured indexer is inventoried and health-checked on the target appliance.",
    ]),
    ("3. Making modest hardware useful", [
        "The preferred playback hierarchy is direct play, then container or audio/subtitle adaptation where sufficient, and full video transcoding only when the client and source genuinely require it. Bounded memory buffers and backpressure reduce disk churn; they do not eliminate CPU, memory, or network costs.",
        "The repository contains pacing, scheduling, storage-headroom, and hardware-classification mechanisms with automated contract tests. Claims about CPU percentage, thermals, latency, power, or 4K reliability remain unverified until repeatable appliance benchmarks record the source, client, codec, subtitles, audio path, and measurement method.",
        "'Transcoding without a GPU, CPU, or disk' is not literal physics. The real opportunity is to make full transcoding rare, preserve compatible video, transform only what is incompatible, and degrade honestly when the machine cannot satisfy a request.",
    ]),
    ("4. Private intelligence without AI slop", [
        "ReelOS rejects the idea that adding generated prose everywhere makes a product intelligent. Rules solve truth and safety. Small local models may rank taste, infer session intent, predict resource pressure, or improve retrieval. Specialized media models may eventually align subtitles, detect scenes, or isolate dialogue. A larger language model is optional and earns a place only when privacy, latency, quality, and cost measurements justify it.",
        "The current deterministic cinema-brain code is a prototype baseline, not proof of a trained recommendation system. Natural-language search parses titles, people, moods, exclusions, duration, content kind, and remembered-scene clues; exact scene retrieval requires a verified indexed timeline. Recommendation explanations must cite an actual connection rather than fabricate confidence scores.",
        "Advanced ideas—spoiler-bounded recaps, sourced commentary, soundtrack moments, character relationships, living posters, acoustic correction, and predictive preparation—are capability-gated. They remain unavailable until an adapter supplies evidence. This is how ReelOS uses intelligence against the 'AI slop' narrative: less generated filler, more private, narrow, measurable assistance behind the experience.",
    ]),
    ("5. Household safety is an authorization system", [
        "A child profile is not a visual theme. ReelOS stores PINs as salted hashes, rate-limits guesses, requires a short-lived one-use authorization to leave an active child profile, and combines participating children's policies using the strictest applicable boundary. Unknown ratings fail closed.",
        "Profile identity and 'kids present' are separate. A household may keep an adult profile active while declaring that children are watching. The resulting admission decision can restrict what starts. Actual dialogue modification and subtitle treatment require verified playback adapters and must never be implied by catalog filtering alone.",
        "Production release still requires escape testing across Back, deep links, refresh, restart, search, pairing, and device handoff, plus authenticated parent authority and appliance-level enforcement.",
    ]),
    ("6. Failure is part of the product", [
        "ReelOS uses explicit unavailable, preparing, retry, and degraded states. Missing Wi-Fi tooling, storage telemetry, update bridges, remote relays, cloud OAuth, media files, lighting bridges, microphone measurements, or installer scripts do not produce success-shaped placeholders.",
        "Exports omit credentials by default. Support bundles redact secrets. Remote assistance cannot activate without a real relay or tunnel. Update, installation, playback, synchronization, and device-pairing success must be reported by the service that performed the work.",
    ]),
    ("7. What the repository currently demonstrates", [
        "The source includes the personal interface shell, profile-specific appearance and taste state, source-aware Home and Library behavior, natural-language search intent, public-domain and personal-library boundaries, secure PIN primitives, child playback admission, reader state, provider validation and cleanup, byte-range streaming contracts, and fail-closed capability responses.",
        "Automated tests cover many units, routes, range boundaries, profile transitions, and adversarial cases. Environment-dependent Linux, browser, hardware, and network checks are explicitly skipped when their required environment is absent. A green source suite is an engineering baseline, not a deployed-appliance certificate.",
    ]),
    ("8. Qualification path", [
        "Release evidence must include a hardware profile; representative codec, subtitle, and audio fixtures; CPU, memory, disk, thermal, and network traces; cold and warm playback; weak-network recovery; provider loss; two-profile isolation; child escape attempts; clean installation; signed update and rollback; backup and restore; and long-running stability.",
        "Each feature belongs in a register with a destination, entry point, interaction states, implementation evidence, dependency, and acceptance check. Items are classified as verified, preview-only, adapter-required, parked, or scrapped. Nothing graduates because its interface looks finished.",
    ]),
    ("Conclusion", [
        "ReelOS is ambitious because it combines a humane cinema-and-books experience with an appliance that knows when not to compute, when not to store, when not to guess, and when to ask for evidence. The project can break old computing assumptions without breaking trust. Its strongest claim is not that limits disappeared; it is that thoughtful architecture can keep those limits out of a person's way far more often than traditional systems do.",
    ]),
]

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>"""
PACKAGE_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"""
WORD_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>"""
STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="24242A"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="15151B"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:sz w:val="27"/><w:color w:val="555563"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="24242A"/></w:rPr></w:style></w:styles>"""


def paragraph_xml(text: str, style: str = "Normal", after: int = 150) -> str:
    return f'<w:p><w:pPr><w:pStyle w:val="{style}"/><w:spacing w:after="{after}"/></w:pPr><w:r><w:t xml:space="preserve">{saxutils.escape(text)}</w:t></w:r></w:p>'


def document_xml() -> str:
    body = [paragraph_xml(TITLE, "Title", 90), paragraph_xml(SUBTITLE, "Subtitle", 220), paragraph_xml(AUTHOR, "Normal", 360)]
    for heading, paragraphs in SECTIONS:
        body.append(paragraph_xml(heading, "Heading1"))
        body.extend(paragraph_xml(p) for p in paragraphs)
    body.append('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1224" w:right="1296" w:bottom="1224" w:left="1296"/></w:sectPr>')
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + "".join(body) + "</w:body></w:document>"


def generate_docx(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", CONTENT_TYPES)
        archive.writestr("_rels/.rels", PACKAGE_RELS)
        archive.writestr("word/_rels/document.xml.rels", WORD_RELS)
        archive.writestr("word/styles.xml", STYLES)
        archive.writestr("word/document.xml", document_xml())


def generate_html(target: Path) -> None:
    chunks = ["<!doctype html><html><head><meta charset='utf-8'>", f"<title>{html.escape(TITLE)}</title>", "<style>body{font-family:Aptos,Segoe UI,sans-serif;max-width:820px;margin:50px auto;padding:0 28px;color:#24242a;line-height:1.62}h1{font-size:2.55rem;line-height:1.08;margin-bottom:.35rem}h2{font-size:1.45rem;margin-top:2.4rem}p.subtitle{font-size:1.28rem;color:#555563}p.author{color:#73737e;margin-bottom:3rem}</style></head><body>", f"<h1>{html.escape(TITLE)}</h1><p class='subtitle'>{html.escape(SUBTITLE)}</p><p class='author'>{html.escape(AUTHOR)}</p>"]
    for heading, paragraphs in SECTIONS:
        chunks.append(f"<h2>{html.escape(heading)}</h2>")
        chunks.extend(f"<p>{html.escape(p)}</p>" for p in paragraphs)
    chunks.append("</body></html>")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("".join(chunks), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the ReelOS technical whitepaper")
    parser.add_argument("--output-dir", default=os.environ.get("REELOS_WHITEPAPER_DIR", str(Path.cwd() / "outputs")))
    args = parser.parse_args()
    output_dir = Path(args.output_dir).expanduser().resolve()
    generate_docx(output_dir / "ReelOS-technical-whitepaper.docx")
    generate_html(output_dir / "ReelOS-technical-whitepaper.html")
    print(f"Generated ReelOS whitepaper in {output_dir}")


if __name__ == "__main__":
    main()
