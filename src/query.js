/**
 * A deliberately bounded diagnostic query language. This is a parser, never eval.
 *
 * query := shortcut | name-search | MATCH node [edge node] RETURN variable [;]
 * node  := (variable:Label [{name:"literal"}])
 * edge  := -[:TYPE]-> | <-[:TYPE]- | -[:TYPE]-
 * Labels/types are case insensitive. Only a bound variable can be returned.
 * There are no writes, WHERE clauses, expressions, multi-hop paths or wildcards.
 */

const LABELS = new Map([
  ['person', 'Person'], ['project', 'Project'], ['skill', 'Skill'],
  ['technology', 'Technology'], ['tool', 'Technology'], ['tech', 'Technology'],
  ['experience', 'Experience'], ['education', 'Education'],
  ['certification', 'Certification'], ['contact', 'Contact'],
]);
const RELATIONS = new Set(['USES', 'BUILT_WITH', 'LEARNED_AT', 'PRODUCED', 'RELATED_TO']);
const SHORTCUTS = new Map([
  ['projects', 'Project'], ['project', 'Project'],
  ['skills', 'Skill'], ['skill', 'Skill'],
  ['tools', 'Technology'], ['technologies', 'Technology'], ['tech', 'Technology'],
  ['experience', 'Experience'], ['experiences', 'Experience'],
  ['education', 'Education'], ['certification', 'Certification'], ['certifications', 'Certification'],
  ['contact', 'Contact'], ['contacts', 'Contact'], ['hire me', 'Contact'],
]);
const SYNTAX = 'Use projects, skills, experience, contact, a name, or MATCH (p:Project) RETURN p.';
const fold = (value) => String(value ?? '').toLocaleLowerCase().trim();
const edgeId = (value) => typeof value === 'string' ? value : value?.id;
const visibleNodes = (graph) => (Array.isArray(graph?.nodes) ? graph.nodes : [])
  .filter((node) => node?.status === 'verified' && typeof node.id === 'string');

class QueryError extends Error {}

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/u.test(char)) { i += 1; continue; }
    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      let closed = false;
      i += 1;
      while (i < input.length) {
        const current = input[i++];
        if (current === quote) { closed = true; break; }
        if (current === '\\') {
          if (i >= input.length) break;
          const escaped = input[i++];
          const escapes = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'" };
          if (!(escaped in escapes)) throw new QueryError('Only quote, backslash, n, r and t escapes are supported inside names.');
          value += escapes[escaped];
        } else {
          value += current;
        }
      }
      if (!closed) throw new QueryError('Close the quoted name with the same quote that opened it.');
      tokens.push({ kind: 'string', value });
      continue;
    }
    const identifier = input.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/u)?.[0];
    if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier });
      i += identifier.length;
      continue;
    }
    if ('():{}[]-<>;'.includes(char)) {
      tokens.push({ kind: char, value: char });
      i += 1;
      continue;
    }
    throw new QueryError(`Unexpected character “${char}”. ${SYNTAX}`);
  }
  return tokens;
}

function parse(input) {
  const tokens = tokenize(input);
  let position = 0;
  const peek = (kind) => tokens[position]?.kind === kind;
  const take = (kind, explanation) => {
    const token = tokens[position++];
    if (token?.kind !== kind) throw new QueryError(explanation || `Expected “${kind}”. ${SYNTAX}`);
    return token.value;
  };
  const keyword = (expected) => {
    if (take('identifier').toUpperCase() !== expected) throw new QueryError(`Expected ${expected}. ${SYNTAX}`);
  };
  const node = () => {
    take('(');
    const variable = take('identifier', 'Give every node a variable, for example (p:Project).');
    take(':', 'Specify a label after the variable, for example (p:Project).');
    const rawLabel = take('identifier');
    const label = LABELS.get(fold(rawLabel));
    if (!label) throw new QueryError(`Unknown node label “${rawLabel}”. Labels: Person, Project, Skill, Technology, Experience, Education, Certification, Contact.`);
    let name;
    if (peek('{')) {
      take('{');
      const field = take('identifier');
      if (field.toLowerCase() !== 'name') throw new QueryError('Only the {name:"…"} filter is supported.');
      take(':');
      name = take('string', 'Quote the name, for example {name:"CAN"}.');
      take('}', 'The name filter must contain one name and end with }.');
    }
    take(')');
    return { variable, label, name };
  };
  keyword('MATCH');
  const left = node();
  let right;
  let relation;
  let direction;
  if (peek('-') || peek('<')) {
    const reverse = peek('<');
    if (reverse) take('<');
    take('-');
    take('[', 'Use a single relationship, for example -[:USES]->.');
    take(':');
    relation = take('identifier').toUpperCase();
    if (!RELATIONS.has(relation)) throw new QueryError(`Unknown relationship “${relation}”. Types: ${[...RELATIONS].join(', ')}.`);
    take(']');
    take('-');
    const forward = peek('>');
    if (forward) take('>');
    if (reverse && forward) throw new QueryError('Choose one arrow direction, or use -[:TYPE]- to match either direction.');
    direction = reverse ? 'reverse' : forward ? 'forward' : 'either';
    right = node();
    if (left.variable === right.variable) throw new QueryError('Use different variables for the two nodes, for example p and s.');
  }
  keyword('RETURN');
  const returning = take('identifier', 'RETURN must name one bound node variable, for example RETURN p.');
  if (returning !== left.variable && returning !== right?.variable) {
    throw new QueryError(`“${returning}” is not a bound node variable. Return ${left.variable}${right ? ` or ${right.variable}` : ''}.`);
  }
  if (peek(';')) take(';');
  if (position !== tokens.length) throw new QueryError('This terminal supports one MATCH, at most one relationship, and one RETURN variable.');
  return { left, right, relation, direction, returning };
}

const matches = (node, pattern) => node.type === pattern.label
  && (pattern.name === undefined || fold(node.name) === fold(pattern.name));

function execute(query, nodes, graph) {
  if (!query.right) return nodes.filter((node) => matches(node, query.left)).map((node) => node.id);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const results = new Set();
  const consider = (leftId, rightId) => {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (left && right && matches(left, query.left) && matches(right, query.right)) {
      results.add(query.returning === query.left.variable ? leftId : rightId);
    }
  };
  for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
    if (edge?.status === 'placeholder' || String(edge?.type ?? edge?.relation).toUpperCase() !== query.relation) continue;
    const source = edgeId(edge.source);
    const target = edgeId(edge.target);
    if (query.direction !== 'reverse') consider(source, target);
    if (query.direction !== 'forward') consider(target, source);
  }
  // Return deterministic graph order, regardless of edge ordering or duplicates.
  return nodes.filter((node) => results.has(node.id)).map((node) => node.id);
}

/** Return verified node IDs; malformed user input is always a recoverable result. */
export function runQuery(input, graph) {
  try {
    if (typeof input !== 'string') throw new QueryError(`Enter a query as text. ${SYNTAX}`);
    const text = input.trim();
    if (!text) return { ids: [], message: SYNTAX };
    if (text.length > 2000) throw new QueryError('Keep diagnostic queries under 2,000 characters.');
    const nodes = visibleNodes(graph);
    const shortcut = fold(text).replace(/\s+/gu, ' ');
    let ids;
    let description;
    if (shortcut === 'all' || shortcut === 'reset' || shortcut === 'clear') {
      ids = nodes.map((node) => node.id);
      description = 'verified nodes';
    } else if (SHORTCUTS.has(shortcut)) {
      const label = SHORTCUTS.get(shortcut);
      ids = nodes.filter((node) => node.type === label).map((node) => node.id);
      description = label === 'Technology' ? 'tools and technologies' : shortcut === 'hire me' ? 'contact channels' : shortcut;
    } else if (/^match\b/iu.test(text)) {
      ids = execute(parse(text), nodes, graph);
      description = 'query matches';
    } else if (/\breturn\b|\[:|->|<-|^(?:create|delete|set|merge|drop|select)\b/iu.test(text)) {
      throw new QueryError(`Only read-only MATCH queries are supported. ${SYNTAX}`);
    } else {
      ids = nodes.filter((node) => fold(node.name).includes(fold(text))).map((node) => node.id);
      description = `matches for “${text}”`;
    }
    return {
      ids,
      message: ids.length ? `${ids.length} ${description}.` : `No verified ${description}. Try a suggested query or “all”.`,
    };
  } catch (error) {
    return { ids: [], message: error instanceof QueryError ? error.message : `Unable to read this query. ${SYNTAX}`, error: true };
  }
}

const literal = (value) => JSON.stringify(String(value));

/** Five examples derived only from categories/names present in the verified graph. */
export function getSuggestions(graph) {
  const nodes = visibleNodes(graph);
  const has = (type) => nodes.some((node) => node.type === type);
  const suggestions = [];
  const add = (label, query) => {
    if (!suggestions.some((item) => item.query === query)) suggestions.push({ label, query });
  };
  if (has('Project')) add('Explore projects', 'projects');
  if (has('Skill')) add('Inspect skills', 'skills');
  if (has('Experience')) add('Read experience', 'experience');

  // Automotive relevance is a presentation grouping, never a claim of a skill.
  // The literal and label always come from an existing verified Skill node.
  const automotiveSkills = nodes.filter((node) => node.type === 'Skill'
    && /\b(?:can|canfd|can fd|lin|autosar|uds|obd|automotive|vehicle|automobile|motor|battery|batterie)\b/iu.test(node.name));
  const automotive = automotiveSkills.find((node) => /^(?:can|canfd|can fd|lin|autosar|uds|obd)$/iu.test(node.name)) ?? automotiveSkills[0];
  if (automotive) {
    const projectQuery = `MATCH (p:Project)-[:USES]-(s:Skill {name:${literal(automotive.name)}}) RETURN p`;
    const experienceQuery = `MATCH (e:Experience)-[:USES]-(s:Skill {name:${literal(automotive.name)}}) RETURN e`;
    add(`Trace ${automotive.name}`, runQuery(projectQuery, graph).ids.length ? projectQuery
      : runQuery(experienceQuery, graph).ids.length ? experienceQuery
        : `MATCH (s:Skill {name:${literal(automotive.name)}}) RETURN s`);
  }
  if (has('Contact')) add('Open contact', 'contact');

  // Sparse draft graphs still receive five useful, safe examples. Prefer actual
  // categories, then individual verified nodes; no missing skill is suggested.
  for (const type of ['Education', 'Certification', 'Technology', 'Person', 'Project', 'Skill', 'Experience', 'Contact']) {
    if (suggestions.length >= 5) break;
    if (has(type)) add(`Inspect ${type.toLowerCase()}`, `MATCH (n:${type}) RETURN n`);
  }
  for (const node of nodes) {
    if (suggestions.length >= 5) break;
    add(node.name, `MATCH (n:${node.type} {name:${literal(node.name)}}) RETURN n`);
  }
  const fallback = [
    { label: 'All verified nodes', query: 'all' },
    { label: 'Reset graph', query: 'reset' },
    { label: 'Clear filter', query: 'clear' },
    { label: 'Query help', query: '' },
    { label: 'Refresh network', query: 'ALL' },
  ];
  for (const item of fallback) {
    if (suggestions.length >= 5) break;
    add(item.label, item.query);
  }
  return suggestions.slice(0, 5);
}
