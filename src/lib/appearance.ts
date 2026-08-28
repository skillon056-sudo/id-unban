// Configurable background-image slots. Admin sets each from /admin/appearance
// (upload a file or paste a URL). Values are stored in the Setting table under
// these keys and read on the homepage.

export interface ImageSlot {
  key: string;
  label: string;
  hint: string;
}

export const IMAGE_SLOTS: ImageSlot[] = [
  { key: "site_logo", label: "Site logo", hint: "Shown in the header. Wide/transparent PNG works best." },
  { key: "img_page_bg", label: "Page background", hint: "Shown faintly behind the whole homepage." },
  { key: "img_hero_bg", label: "Hero background", hint: "Large image behind the headline + search box." },
  { key: "img_banner_top", label: "Top banner", hint: "Wide banner strip above the hero." },
  { key: "img_banner_mid", label: "Middle banner", hint: "Wide promo banner between sections." },
  { key: "img_section_bg", label: "Features background", hint: "Behind the trust / features cards." },
  { key: "img_faq_bg", label: "FAQ background", hint: "Behind the FAQ section." },
  { key: "img_footer_bg", label: "Footer background", hint: "Behind the footer." },
];

export const IMAGE_KEYS = IMAGE_SLOTS.map((s) => s.key);
