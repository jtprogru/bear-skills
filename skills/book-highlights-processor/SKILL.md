---
name: book-highlights-processor
description: Экспорт хайлайтов книг из iBooks/Zotero → Obsidian callouts с claim-заголовками и ==выделением== ключевых фраз. Триггеры — «обработай цитаты/хайлайты», «разбери экспорт из книги», «обработай импорт из iBooks/Zotero».
---

<!-- СГЕНЕРИРОВАНО bin/mirror.js. Не редактировать: правки затрёт следующая генерация.
     Источник правды — domains/<домен>/. -->

# Book Highlights Processor

Transform exported book highlight files into enriched Obsidian callouts with AI-generated titles and highlighted key phrases.

## Input format

The markdown file from iBooks or Zotero looks like this:

```
---
book: Book Title
author: Author Name
language: ru
tags:
- ibook/imported
- literature
---

## 📔 Книга: Book Title

**Автор**:: Author Name
...

---

# 🔍 How I Discovered IT

- 📚
    - 🎯Quote text here, possibly several sentences or paragraphs
        - ✍️Reader's own note or commentary (optional)
    - 🎯Another quote
        - ✍️Another note
```

## What to produce

For each `🎯` quote, output an Obsidian callout:

```
> [!quote] Generated Title
> Quote text with ==key phrase== and ==another key phrase== highlighted.
>
> ✍️ Reader's note text
```

If the quote has no `✍️` note, omit the last line.

Never add commentary of your own — no summary line before the quote, no takeaway after it. The callout carries the source's words, the reader's note and nothing else; anything explaining the quote back to the reader is the filler `../../rules/note-density.md` forbids.

## How to generate the title

The title goes into the callout header and will likely become the filename of a future Obsidian atomic note. Naming style (claim-based, 4–8 words, language rules) — see `../../rules/file-naming.md`.

Draw on the `✍️` reader note as a signal of what *the reader* found important — that's the insight to encode in the title, not just a paraphrase of the raw quote.

Examples from SRE context:
- "Мониторинг min/max ловит сбои, которые среднее скрывает"
- "Fallback должен существовать даже в виде тетриса"
- "Graceful Degradation требует нескольких уровней готовности"
- "Ретраи без backoff превращают деградацию в катастрофу"

## How to add highlights

Add `==highlight==` to 2–4 phrases per quote. Choose phrases that:
- Carry the core claim or mechanism
- Help a reader scanning the quote instantly grasp the main point
- Are short (3–8 words each)

Avoid highlighting entire sentences — pick the densest, most meaningful fragments.

## Output structure

Keep the frontmatter and the header block (book title, author, link) **as-is**, with two additions (see policies in `../../rules/note-types-frontmatter.md`):

- append `ai_generated: true`, because titles and highlights in the body are agent-generated;
- if `summary` is missing or empty, fill it after processing all quotes: 1–3 sentences in Russian — the book's central claim as seen through its highlights. Plain text, no wikilinks or markdown. If a non-empty `summary` already exists, leave it untouched.

If a field already exists with the same value, leave it; do not duplicate.

Replace the entire `- 📚` list block with sequential callouts — no list bullets, no `📚` wrapper, just callouts separated by a blank line.

The final file should look like:

```
---
(frontmatter unchanged)
---

## 📔 Книга: ...
(header block unchanged)

---

# 🔍 How I Discovered IT

> [!quote] First Title
> Quote one with ==highlights==.
>
> ✍️ Note one

> [!quote] Second Title
> Quote two with ==highlights==.

> [!quote] Third Title
> Long quote three with ==important phrase== somewhere in the middle.
>
> ✍️ Note three
```

## Workflow

1. Read the full file first — understand the domain and vocabulary before generating titles.
2. Process all quotes sequentially.
3. Rewrite the file with `Edit` or `Write`, preserving frontmatter and header section.
4. If the file is very long (20+ quotes), process and write in one pass — don't ask the user to confirm each quote.
