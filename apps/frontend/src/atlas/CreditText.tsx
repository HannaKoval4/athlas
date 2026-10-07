import Markdown from 'react-markdown';

/**
 * Image credit stored as inline Markdown ("Author · CC BY-SA 4.0 · [Wikimedia Commons](url)").
 * Only text and links are rendered; links open the file page in a new tab.
 */
export function CreditText({ credit }: { credit: string }) {
  return (
    <Markdown
      allowedElements={['a']}
      unwrapDisallowed
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
            {children}
          </a>
        ),
      }}
    >
      {credit}
    </Markdown>
  );
}
