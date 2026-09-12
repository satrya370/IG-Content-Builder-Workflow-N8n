const DEFAULT_SLIDES_COUNT = 5;

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)(\?|$)/i;

const IMAGE_HOST_PATTERNS = [
  /images\.unsplash\.com/i,
  /raw\.githubusercontent\.com/i,
  /cdn\.simpleicons\.org/i,
  /github\.com\/[^/]+\/[^/]+\/assets\//i,
  /avatars\.githubusercontent\.com/i,
  /\.githubusercontent\.com/i,
];

const SOURCE_TYPE_SCORES = {
  'brand-map': 100,
  'og-image': 90,
  'official-site': 80,
  'github-readme': 70,
  'simpleicons': 60,
  'fallback': 10,
};

// ═══════════════════════════════════════════════════════════════════════
// Phase 1: Image plan construction
// ═══════════════════════════════════════════════════════════════════════

function buildImagePlan(template, topic, briefPlan) {
  switch (template) {
    case 'visual-content':
      return buildVisualContentImagePlan(topic, briefPlan);
    case 'news-content':
      return buildNewsContentImagePlan(topic, briefPlan);
    case 'code-content':
      return buildCodeContentImagePlan(topic, briefPlan);
    default:
      return { template, intro: null, slides: [], introLogoSlots: [] };
  }
}

function normalizeImagePlan(imagePlan, template) {
  if (!imagePlan || typeof imagePlan !== 'object') {
    return buildImagePlan(template, '', {});
  }

  const normalized = { ...imagePlan, template };

  if (template === 'visual-content') {
    if (!normalized.intro) {
      normalized.intro = { assetType: '3d-render', query: '', preferredDomains: [], mustReuseForClosing: false };
    }
    if (!Array.isArray(normalized.slides) || normalized.slides.length === 0) {
      normalized.slides = Array.from({ length: DEFAULT_SLIDES_COUNT }, (_, i) => ({
        slot: i + 1, query: '', assetType: 'ui-screenshot', preferredDomains: [], subject: '',
      }));
    }
    normalized.introLogoSlots = [];
  }

  if (template === 'news-content') {
    if (!normalized.intro) {
      normalized.intro = { assetType: 'hero-image', query: '', preferredDomains: [], mustReuseForClosing: true };
    }
    normalized.intro.mustReuseForClosing = true;
    normalized.slides = [];
    normalized.introLogoSlots = [];
  }

  if (template === 'code-content') {
    normalized.intro = null;
    normalized.slides = [];
    normalized.introLogoSlots = normalizeCodeIntroLogos(normalized.introLogoSlots || []);
  }

  return normalized;
}

function normalizeCodeIntroLogos(input) {
  if (!Array.isArray(input)) {
    input = [];
  }

  const slots = input.map((item, i) => ({
    slot: i + 1,
    brandName: item?.brandName || '',
    officialSite: item?.officialSite || '',
    githubRepo: item?.githubRepo || '',
    logoHints: Array.isArray(item?.logoHints) ? item.logoHints : [],
  }));

  while (slots.length < 4) {
    slots.push({ slot: slots.length + 1, brandName: '', officialSite: '', githubRepo: '', logoHints: [] });
  }

  return slots.slice(0, 4);
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 2: Image resolution and validation
// ═══════════════════════════════════════════════════════════════════════

function validateImageCandidate(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, contentType: '', error: 'empty or non-string URL' };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, contentType: '', error: 'empty URL' };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, contentType: '', error: 'invalid URL format' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, contentType: '', error: 'non-http protocol' };
  }

  const isImageExtension = IMAGE_EXTENSIONS.test(parsed.pathname);
  const isImageHost = IMAGE_HOST_PATTERNS.some(p => p.test(trimmed));

  if (!isImageExtension && !isImageHost) {
    return { valid: false, contentType: '', error: 'URL does not look like an image' };
  }

  let contentType = 'image/png';
  if (isImageExtension) {
    const ext = parsed.pathname.match(IMAGE_EXTENSIONS)?.[1]?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'svg') contentType = 'image/svg+xml';
    else if (ext === 'ico') contentType = 'image/x-icon';
  }

  return { valid: true, contentType };
}

function buildPlaceholderCandidate(label, sourcePage) {
  const text = encodeURIComponent(String(label || 'visual content').replace(/\s+/g, ' ').trim().slice(0, 80));
  const url = `https://placehold.co/1080x1350/0f172a/ffffff.png?text=${text}`;
  const validation = validateImageCandidate(url);

  return {
    url,
    sourceType: 'fallback',
    sourcePage: sourcePage || '',
    validated: validation.valid,
    contentType: validation.contentType || 'image/png',
  };
}

function scoreImageCandidate(candidate) {
  const base = SOURCE_TYPE_SCORES[candidate.sourceType] || 0;

  let bonus = 0;
  if (candidate.validated) bonus += 5;
  if (candidate.url && candidate.url.length < 200) bonus += 2;

  return base + bonus;
}

function resolveCodeIntroLogos(logoSlots, brandMap) {
  if (!Array.isArray(logoSlots) || !brandMap) return [];

  return logoSlots.map(slot => {
    const slug = (slot.brandName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const brand = brandMap[slug] || brandMap[slot.brandName.toLowerCase()] || null;

    if (brand) {
      const validation = validateImageCandidate(brand.logoUrl || '');
      return {
        ...slot,
        resolved: {
          url: brand.logoUrl || '',
          sourceType: 'brand-map',
          sourcePage: brand.officialSite,
          validated: validation.valid,
          contentType: validation.contentType || '',
        },
      };
    }

    if (slot.officialSite) {
      return {
        ...slot,
        resolved: {
          url: `${slot.officialSite}/favicon.ico`,
          sourceType: 'official-site',
          sourcePage: slot.officialSite,
          validated: false,
          contentType: 'image/x-icon',
        },
      };
    }

    if (slot.githubRepo) {
      const org = slot.githubRepo.split('/')[0];
      return {
        ...slot,
        resolved: {
          url: `https://avatars.githubusercontent.com/${org}`,
          sourceType: 'fallback',
          sourcePage: `https://github.com/${slot.githubRepo}`,
          validated: false,
          contentType: 'image/png',
        },
      };
    }

    return {
      ...slot,
      resolved: {
        url: '',
        sourceType: 'fallback',
        sourcePage: '',
        validated: false,
        contentType: '',
      },
    };
  });
}

function resolveNewsHeroImage(intro, findings) {
  const sources = extractAllSources(findings);

  for (const src of sources) {
    if (src.ogImage) {
      const v = validateImageCandidate(src.ogImage);
      if (v.valid) {
        return { url: src.ogImage, sourceType: 'og-image', sourcePage: src.url, validated: true, contentType: v.contentType };
      }
    }
  }

  return buildPlaceholderCandidate(intro?.query || findings?.primaryFocus || findings?.mpId || 'news hero image', sources[0]?.url || '');
}

function resolveVisualSlideImage(slide, findings) {
  const sources = extractAllSources(findings);

  for (const src of sources) {
    if (src.readmeImages && src.readmeImages.length > 0) {
      for (const img of src.readmeImages) {
        const v = validateImageCandidate(img);
        if (v.valid) {
          return { url: img, sourceType: 'github-readme', sourcePage: src.url, validated: true, contentType: v.contentType };
        }
      }
    }
  }

  return buildPlaceholderCandidate(slide?.subject || slide?.query || findings?.primaryFocus || findings?.mpId || 'visual slide', sources[0]?.url || '');
}

function resolveVisualIntroImage(findings) {
  const sources = extractAllSources(findings);

  for (const src of sources) {
    if (Array.isArray(src.readmeImages)) {
      for (const img of src.readmeImages) {
        const v = validateImageCandidate(img);
        if (v.valid) {
          return { url: img, sourceType: 'github-readme', sourcePage: src.url, validated: true, contentType: v.contentType };
        }
      }
    }

    if (src.ogImage) {
      const v = validateImageCandidate(src.ogImage);
      if (v.valid) {
        return { url: src.ogImage, sourceType: 'og-image', sourcePage: src.url, validated: true, contentType: v.contentType };
      }
    }
  }

  return buildPlaceholderCandidate(findings?.primaryFocus || findings?.mpId || 'visual intro', sources[0]?.url || '');
}

function resolveImagePlan(briefPlan, findings, brandMap) {
  const template = briefPlan?.template || findings?.template || '';
  const normalized = normalizeImagePlan(briefPlan, template);

  const result = {
    mpId: briefPlan?.mpId || findings?.mpId || '',
    template,
    intro: null,
    slides: [],
    introLogoSlots: [],
    createdAt: new Date().toISOString(),
  };

  if (template === 'news-content' && normalized.intro) {
    result.intro = toPrimaryCandidateContainer(resolveNewsHeroImage(normalized.intro, findings));
  }

  if (template === 'visual-content') {
    if (normalized.intro) {
      result.intro = toPrimaryCandidateContainer(resolveVisualIntroImage(findings));
    }
    result.slides = (normalized.slides || []).map(slide => {
      const resolved = resolveVisualSlideImage(slide, findings);
      return {
        slot: slide.slot,
        subject: slide.subject,
        primary: resolved,
        alternates: [],
      };
    });
  }

  if (template === 'code-content') {
    result.introLogoSlots = resolveCodeIntroLogos(normalized.introLogoSlots || [], brandMap || {}).map(slot => ({
      slot: slot.slot,
      brandName: slot.brandName,
      officialSite: slot.officialSite,
      githubRepo: slot.githubRepo,
      logoHints: slot.logoHints,
      primary: slot.resolved,
      alternates: [],
    }));
  }

  return result;
}

function toPrimaryCandidateContainer(candidate) {
  return {
    primary: candidate,
    alternates: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════

function extractAllSources(findings) {
  if (!findings || typeof findings !== 'object') return [];
  const topics = findings.topics || [];
  const sources = [];
  for (const topic of topics) {
    if (topic.sources && Array.isArray(topic.sources)) {
      sources.push(...topic.sources);
    }
  }
  return sources;
}

function isOfficialDomain(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return !host.includes('unsplash.com')
      && !host.includes('pinterest.com')
      && !host.includes('reddit.com')
      && !host.includes('quora.com');
  } catch {
    return false;
  }
}

function extractSubtopics(briefPlan) {
  if (!briefPlan || typeof briefPlan !== 'object') return [];
  const topics = briefPlan.researchTopics || briefPlan.subtopics || [];
  if (Array.isArray(topics)) {
    return topics.map(t => (typeof t === 'string' ? t : t.topic || t.name || '')).filter(Boolean);
  }
  return [];
}

function extractBrandNames(topic, briefPlan) {
  const names = [];

  if (topic) {
    const separators = /\s+(vs|vs\.|versus|and|,&)\s+/i;
    if (separators.test(topic)) {
      topic.split(separators).forEach(part => {
        const cleaned = part.replace(/[,&\s]+/g, ' ').trim();
        if (cleaned && cleaned.length > 1 && !/^(vs|vs\.|versus|and)$/i.test(cleaned)) {
          names.push(cleaned);
        }
      });
    }
  }

  if (briefPlan?.brands && Array.isArray(briefPlan.brands)) {
    briefPlan.brands.forEach(b => {
      const n = typeof b === 'string' ? b : b.name || '';
      if (n && !names.includes(n)) names.push(n);
    });
  }

  return names.length >= 4 ? names : [...names, 'OpenAI', 'Anthropic', 'Google', 'GitHub'].slice(0, 4);
}

function guessOfficialSite(name) {
  const domain = name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(www)?/, '');
  return `https://www.${domain}.com`;
}

function guessGitHubRepo(name) {
  const org = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return org ? `${org}/${org}` : '';
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 1 builders (private)
// ═══════════════════════════════════════════════════════════════════════

function buildVisualContentImagePlan(topic, briefPlan) {
  const subtopics = extractSubtopics(briefPlan);
  const slides = Array.from({ length: DEFAULT_SLIDES_COUNT }, (_, i) => ({
    slot: i + 1,
    query: subtopics[i] ? `${subtopics[i]} official screenshot or UI` : `${topic} screenshot ${i + 1}`,
    assetType: 'ui-screenshot',
    preferredDomains: ['github.com', 'raw.githubusercontent.com'],
    subject: subtopics[i] || `slide ${i + 1}`,
  }));

  return {
    template: 'visual-content',
    intro: {
      assetType: '3d-render',
      query: `${topic} 3D render tech dark background`,
      preferredDomains: [],
      mustReuseForClosing: false,
    },
    slides,
    introLogoSlots: [],
  };
}

function buildNewsContentImagePlan(topic, briefPlan) {
  return {
    template: 'news-content',
    intro: {
      assetType: 'hero-image',
      query: `${topic} official image or article photo`,
      preferredDomains: [],
      mustReuseForClosing: true,
    },
    slides: [],
    introLogoSlots: [],
  };
}

function buildCodeContentImagePlan(topic, briefPlan) {
  const brandNames = extractBrandNames(topic, briefPlan);
  const logoSlots = brandNames.slice(0, 4).map((name, i) => ({
    slot: i + 1,
    brandName: name,
    officialSite: guessOfficialSite(name),
    githubRepo: guessGitHubRepo(name),
    logoHints: [`${name} official logo`, `${name} brand icon`],
  }));

  return {
    template: 'code-content',
    intro: null,
    slides: [],
    introLogoSlots: normalizeCodeIntroLogos(logoSlots),
  };
}

module.exports = {
  buildImagePlan,
  normalizeImagePlan,
  normalizeCodeIntroLogos,
  resolveCodeIntroLogos,
  resolveNewsHeroImage,
  resolveVisualSlideImage,
  resolveImagePlan,
  validateImageCandidate,
  scoreImageCandidate,
};
