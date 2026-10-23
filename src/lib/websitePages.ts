// src/lib/websitePages.ts
// The existing hand-built website pages, grouped. Used by the Page SEO screen.
// Each of these has a layout.js importing { pageMetadata, PageSchema } from
// "@/utils/pageSeo", which now resolves to the page_seo connector - so creating
// a record here drives that page's head with no developer change.

export type PageGroup = { group: string; slugs: string[] };

export const WEBSITE_PAGES: PageGroup[] = [
  {
    group: "Channels",
    slugs: [
      "whatsapp-business-api",
      "whatsapp-chatbot",
      "whatsapp-live-chat",
      "rcs-business-messaging",
      "rcs-live-chat",
      "sms-marketing",
      "two-way-sms",
      "instagram-business",
      "instagram-live-chat",
      "website-live-chat",
      "live-chat-services",
      "click-to-call",
      "missed-call-services",
      "inbound-dialer",
      "outbound-dialer",
      "email-otp",
      "user-verification",
    ],
  },
  {
    group: "Industries",
    slugs: [
      "healthcare",
      "retail-and-ecommerce",
      "financial-services",
      "education-and-edtech",
      "construction-and-real-estate",
      "food-and-beverages",
      "travel-and-tourism",
      "professional-services",
      "tech-startups",
    ],
  },
  {
    group: "CPaaS",
    slugs: [
      "cpaas-solutions",
      "communication-platform-cpaas",
      "custom-applications",
      "integrations",
    ],
  },
  {
    group: "Company",
    slugs: ["about-us", "pricing"],
  },
];

export const ALL_WEBSITE_SLUGS: string[] = WEBSITE_PAGES.flatMap((g) => g.slugs);

export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
