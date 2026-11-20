#!/usr/bin/env python3
"""Build the downloadable sample decks in examples/decks/ and zip them into examples/downloads/.

Each deck is a folder:
    <deck>/manifest.json
    <deck>/cards.csv
    <deck>/media/images/  media/audio/  media/video/
The zip of that folder, renamed to .lernpack, is what users import.
Needs Pillow (pip install pillow) for the generated pictures.
"""
import csv, io, json, math, pathlib, shutil, zipfile
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
DECKS = ROOT / "examples" / "decks"
OUT = ROOT / "examples" / "downloads"


def manifest(name, language, description, goal=None):
    m = {"format": "lernpack", "version": 1,
         "deck": {"name": name, "language": language, "description": description},
         "generator": "LernLab sample decks"}
    if goal:
        m["deck"]["goal"] = goal
    return m


def write_deck(folder, man, header, rows):
    d = DECKS / folder
    if d.exists():
        shutil.rmtree(d)
    for sub in ("images", "audio", "video"):
        (d / "media" / sub).mkdir(parents=True, exist_ok=True)
    (d / "manifest.json").write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with open(d / "cards.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    return d


def colour_png(path, rgb):
    img = Image.new("RGB", (320, 320), (250, 248, 245))
    ImageDraw.Draw(img).rounded_rectangle((40, 40, 280, 280), radius=28, fill=rgb, outline=(60, 56, 50), width=3)
    img.save(path, optimize=True)


def spin_gif(path):
    frames = []
    for i in range(12):
        img = Image.new("RGB", (240, 240), (250, 248, 245))
        dr = ImageDraw.Draw(img)
        a = i * math.pi / 6
        pts = [(120 + 70 * math.cos(a + k * math.pi / 2), 120 + 70 * math.sin(a + k * math.pi / 2)) for k in range(4)]
        dr.polygon(pts, fill=(47, 91, 183))
        frames.append(img)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=80, loop=0)


def blink_gif(path):
    frames = []
    for i in range(8):
        img = Image.new("RGB", (240, 240), (250, 248, 245))
        if i % 2 == 0:
            ImageDraw.Draw(img).ellipse((60, 60, 180, 180), fill=(230, 159, 0))
        frames.append(img)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=300, loop=0)


def german_colours():
    colours = [("rot", "red", (213, 94, 0)), ("blau", "blue", (0, 114, 178)), ("grün", "green", (0, 158, 115)),
               ("gelb", "yellow", (240, 228, 66)), ("schwarz", "black", (30, 30, 30)), ("weiß", "white", (255, 255, 255)),
               ("orange", "orange", (230, 159, 0)), ("lila", "purple", (150, 90, 170))]
    rows = []
    for de, en, rgb in colours:
        file = de.replace("ü", "ue").replace("ß", "ss") + ".png"
        rows.append([de, en, f"Der Ball ist <b>{de}</b>.", f"The ball is {en}.", "colours", f"images/{file}", ""])
    rows.append(["drehen", "to turn, to spin", "Das Rad <b>dreht</b> sich.", "The wheel turns.", "verbs", "images/drehen.gif", ""])
    rows.append(["blinken", "to blink, to flash", "Das Licht <b>blinkt</b>.", "The light blinks.", "verbs", "images/blinken.gif", ""])
    d = write_deck("german-colours-with-pictures",
                   manifest("German: colours (with pictures)", "de", "Colour words and two verbs, with pictures and animated GIFs."),
                   ["front", "back", "example", "example translation", "category", "image", "audio"], rows)
    for de, _, rgb in colours:
        colour_png(d / "media" / "images" / (de.replace("ü", "ue").replace("ß", "ss") + ".png"), rgb)
    spin_gif(d / "media" / "images" / "drehen.gif")
    blink_gif(d / "media" / "images" / "blinken.gif")
    (d / "media" / "audio" / "README.txt").write_text("Put pronunciation files here (mp3, ogg, m4a) and name them in the 'audio' column, e.g. audio/rot.mp3\n", encoding="utf-8")


def from_existing(folder, src, name, language, description, delimiter=","):
    text = (ROOT / "examples" / src).read_text(encoding="utf-8")
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    write_deck(folder, manifest(name, language, description), rows[0], rows[1:])


def template():
    d = write_deck("template", manifest("My deck", None, "Replace this with what the deck is about."),
                   ["front", "back", "example", "category", "tags", "image", "audio", "video", "type", "choices", "correct"],
                   [["What is the front?", "The question or the word to learn", "", "basics", "", "", "", "", "", "", ""],
                    ["Which two are fruits?", "", "", "basics", "", "", "", "", "mcq", "apple|carrot|banana|potato", "1|3"],
                    ["the dog", "der Hund", "Der Hund bellt.", "animals", "german", "images/dog.jpg", "audio/dog.mp3", "", "", "", ""]])
    for sub, kinds in (("images", "jpg, png, webp, gif (animated GIFs work)"), ("audio", "mp3, ogg, m4a, wav"), ("video", "mp4, webm")):
        (d / "media" / sub / "README.txt").write_text(f"Put {sub} here ({kinds}). Refer to them in cards.csv as {sub}/<file name>.\n", encoding="utf-8")


def zip_deck(folder, out_name):
    OUT.mkdir(parents=True, exist_ok=True)
    src = DECKS / folder
    with zipfile.ZipFile(OUT / out_name, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(src.rglob("*")):
            arc = (pathlib.Path(folder) / p.relative_to(src)).as_posix() + ("/" if p.is_dir() else "")
            if p.is_dir():
                z.writestr(arc, "")
            else:
                z.write(p, arc)


if __name__ == "__main__":
    german_colours()
    from_existing("aws-cloud-basics", "aws-cloud-basics.csv", "AWS Cloud basics", None, "Core AWS services for the Cloud Practitioner exam.")
    from_existing("biology-the-cell", "biology-cells.tsv", "Biology: the cell", None, "Parts of the cell and what they do.", delimiter="\t")
    from_existing("german-a1-starter", "german-a1-starter.csv", "German A1 starter", "de", "First words for German A1.")
    template()
    for f in ("german-colours-with-pictures", "aws-cloud-basics", "biology-the-cell", "german-a1-starter", "template"):
        zip_deck(f, f + ".zip")
    print("built", sorted(p.name for p in OUT.iterdir()))
