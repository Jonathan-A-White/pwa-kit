// The requests filed, grouped by who asked, each with where it stands. Presentational: the records, the names and the words are the app's.
import { statusLine, webLink, type RequestRecord } from './status.js';

export interface RequestGroup {
  who: string;
  records: RequestRecord[];
}

/** The records grouped by who asked, each group newest first. The people in `order` come first, in that order; anyone else follows,
 * the person with the newest request first. */
export function groupByWho(records: readonly RequestRecord[], order: readonly string[] = []): RequestGroup[] {
  const groups = new Map<string, RequestRecord[]>();
  for (const record of [...records].sort((a, b) => b.sentAt - a.sentAt)) {
    const group = groups.get(record.who);
    if (group) group.push(record);
    else groups.set(record.who, [record]);
  }
  const named = order.flatMap((who) => (groups.has(who) ? [{ who, records: groups.get(who) ?? [] }] : []));
  const rest = [...groups].filter(([who]) => !order.includes(who)).map(([who, rs]) => ({ who, records: rs }));
  return [...named, ...rest];
}

export interface RequestsListProps {
  records: readonly RequestRecord[];
  /** The words for each who ({ 'grown-up': 'A grown-up', ruth: 'Ruth' }); the who itself when none. */
  names?: Readonly<Record<string, string>>;
  /** The words for each kind of ask; the kind itself when none. */
  kinds?: Readonly<Record<string, string>>;
  /** The people in the order to draw them. */
  order?: readonly string[];
  /** What to say when nothing was asked. */
  empty?: string;
}

const sentOn = (ms: number): string => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Request({ record, kinds }: { record: RequestRecord; kinds: Readonly<Record<string, string>> }) {
  const line = statusLine(record);
  const link = record.status === 'landed' ? webLink(record.url) : undefined;
  return (
    <li data-request={record.id} className="bk-requests__request">
      <p className="bk-requests__what">{record.summary || record.words}</p>
      <p className="bk-requests__sent">
        {kinds[record.kind] ?? record.kind} · <time dateTime={record.day}>{sentOn(record.sentAt)}</time>
      </p>
      <p data-request-status className="bk-requests__status">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer">
            {line}
          </a>
        ) : (
          line
        )}
      </p>
    </li>
  );
}

/** A group for each person who asked, under their name, with their requests. */
export function RequestsList({ records, names = {}, kinds = {}, order = [], empty = 'Nothing asked yet.' }: RequestsListProps) {
  const groups = groupByWho(records, order);
  if (groups.length === 0) {
    return (
      <p data-requests-empty className="bk-requests__empty">
        {empty}
      </p>
    );
  }
  return (
    <div className="bk-requests">
      {groups.map(({ who, records: mine }) => {
        const name = names[who] ?? who;
        return (
          <section key={who} data-who={who} className="bk-requests__group">
            <h3 className="bk-requests__who">{name}</h3>
            <ul aria-label={`Requests of ${name}`} className="bk-requests__list">
              {mine.map((record) => (
                <Request key={record.id} record={record} kinds={kinds} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
