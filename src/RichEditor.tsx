import { useEffect, useRef, type ReactNode } from "react";
import { htmlToMarkdown, markdownToHtml } from "./lib/richtext";

function Tool({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "adm-look-tool is-on" : "adm-look-tool"}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Same format strip as the CV summary field — marks still save as markdown. */
export function RichEditor({
  label,
  value,
  placeholder,
  minHeight = 140,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  minHeight?: number;
  onChange: (next: string) => void;
}) {
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = area.current;
    if (!node) return;
    if (htmlToMarkdown(node) === value) return;
    node.innerHTML = markdownToHtml(value);
  }, [value]);

  const emit = () => {
    if (area.current) onChange(htmlToMarkdown(area.current));
  };

  const run = (command: string, arg?: string) => {
    area.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const toggleCase = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const text = selection.toString();
    if (!text) return;
    const next = text === text.toUpperCase() ? text.toLowerCase() : text.toUpperCase();
    area.current?.focus();
    document.execCommand("insertText", false, next);
    emit();
  };

  const addLink = () => {
    const href = window.prompt("Link URL", "https://");
    if (!href) return;
    run("createLink", href);
  };

  return (
    <div className="adm-editor-box">
      <div className="adm-look-bar" role="toolbar" aria-label="Text style">
        <Tool label="Bold" onClick={() => run("bold")}>
          <strong>B</strong>
        </Tool>
        <Tool label="Italic" onClick={() => run("italic")}>
          <em>I</em>
        </Tool>
        <Tool label="Underline" onClick={() => run("underline")}>
          <u>U</u>
        </Tool>
        <Tool label="Strikethrough" onClick={() => run("strikeThrough")}>
          <s>S</s>
        </Tool>
        <Tool label="Change case" onClick={toggleCase}>
          <span className="adm-look-case">aA</span>
        </Tool>
        <div className="adm-look-sep" aria-hidden="true" />
        <Tool label="Heading" onClick={() => run("formatBlock", "h2")}>
          <span className="adm-look-case">H</span>
        </Tool>
        <Tool label="Link" onClick={addLink}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.5 9.5a3 3 0 0 0 4.2.3l1.8-1.8a3 3 0 0 0-4.2-4.2L7.5 4.5" />
            <path d="M9.5 6.5a3 3 0 0 0-4.2-.3L3.5 8a3 3 0 0 0 4.2 4.2L8.5 11.5" />
          </svg>
        </Tool>
        <Tool label="Bullet list" onClick={() => run("insertUnorderedList")}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3" cy="4" r="1.2" />
            <circle cx="3" cy="8" r="1.2" />
            <circle cx="3" cy="12" r="1.2" />
            <path d="M6 4h8M6 8h8M6 12h8" />
          </svg>
        </Tool>
        <Tool label="Numbered list" onClick={() => run("insertOrderedList")}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3.5h1.2M3.6 3.5V7M3 7h1.2M2.8 9.2h1.6c.5 0 .9.3.9.8s-.4.8-.9.8H3.5L4.4 13H2.8" />
            <path d="M6 4h8M6 8h8M6 12h8" />
          </svg>
        </Tool>
      </div>
      <label className="adm-editor-field">
        <span>{label}</span>
        <div
          ref={area}
          className="adm-rich-area"
          style={{ minHeight }}
          contentEditable
          role="textbox"
          aria-label={label}
          data-placeholder={placeholder}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
        />
      </label>
    </div>
  );
}
