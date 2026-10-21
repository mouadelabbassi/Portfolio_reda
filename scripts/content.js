export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = url => /^(https:\/\/|mailto:|tel:|\/(?!\/))/.test(url || '') ? url : '';
const listLinks = links => (links || []).filter(link => safeURL(link.url)).map(link => `<a href="${escapeHTML(link.url)}"${link.url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHTML(link.label)} <span aria-hidden="true">↗</span></a>`).join('');

export function seoTags(graph) {
  const title = `${graph.profile.name} — ${graph.profile.headline} | ME/SIGNAL`;
  return `<title>${escapeHTML(title)}</title>
  <meta name="description" content="${escapeHTML(graph.profile.summary)}">
  <meta property="og:type" content="website"><meta property="og:title" content="${escapeHTML(title)}">
  <meta property="og:description" content="${escapeHTML(graph.profile.summary)}">
  <meta property="og:image" content="/og-signal.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0a1013">`;
}

export function classicMarkup(graph) {
  const nodes = graph.nodes.filter(n => n.status === 'verified');
  const sections = [ ['Experience','Experience'],['Project','Projects'],['Education','Education'],['Skill','Skills'],['Technology','Tools & technologies'],['Certification','Certifications'],['Contact','Contact'] ];
  return `<div class="classic-top"><span class="brand">ME<span>/</span>SIGNAL</span><span>ENGINEERING PORTFOLIO</span></div>
  <section class="classic-intro"><p class="eyebrow">ELECTRICAL · EMBEDDED · AUTOMOTIVE</p><h1>${escapeHTML(graph.profile.name)}</h1><p class="classic-headline">${escapeHTML(graph.profile.headline)}</p><p>${escapeHTML(graph.profile.summary)}</p>${graph.profile.cvDownloadUrl ? `<a class="primary-link" href="${escapeHTML(graph.profile.cvDownloadUrl)}" download>Download CV <span aria-hidden="true">↗</span></a>` : ''}</section>
  ${sections.map(([type,title]) => {const items = nodes.filter(n => n.type === type); if (!items.length) return ''; return `<section class="classic-section" id="classic-${type.toLowerCase()}"><div class="section-heading"><span class="eyebrow">${escapeHTML(type)}</span><h2>${title}</h2></div><div class="classic-items ${type === 'Skill' || type === 'Technology' ? 'compact-items' : ''}">${items.map(n => `<article id="cv-${escapeHTML(n.id)}"><h3>${escapeHTML(n.name)}</h3>${n.details.organization || n.details.dateLabel ? `<p class="classic-meta">${escapeHTML([n.details.organization,n.details.dateLabel].filter(Boolean).join(' · '))}</p>` : ''}${n.details.summary ? `<p>${escapeHTML(n.details.summary)}</p>` : ''}${n.details.problem ? `<p><strong>Problem.</strong> ${escapeHTML(n.details.problem)}</p>` : ''}${n.details.role ? `<p><strong>Contribution.</strong> ${escapeHTML(n.details.role)}</p>` : ''}${n.details.outcome ? `<p><strong>Outcome.</strong> ${escapeHTML(n.details.outcome)}</p>` : ''}${(n.details.stackNodeIds || []).length ? `<div class="tag-list">${n.details.stackNodeIds.map(id => `<span>${escapeHTML(nodes.find(x => x.id===id)?.name || id)}</span>`).join('')}</div>` : ''}<div class="classic-links">${listLinks(n.details.links)}</div></article>`).join('')}</div></section>`}).join('')}
  <footer class="classic-footer"><span>ME/SIGNAL · ${escapeHTML(graph.profile.name)}</span><span>One network. Many connections.</span></footer>`;
}
