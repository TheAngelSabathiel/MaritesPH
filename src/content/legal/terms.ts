import type { LegalDoc } from "./types";

// TO REVIEW: terms of use draft.
export const termsOfUse: LegalDoc = {
  en: [
    {
      heading: "About these terms",
      paragraphs: [
        "These terms apply when you use Marites PH, operated by [OPERATOR NAME]. By using the site you agree to them.",
      ],
    },
    {
      heading: "What Marites PH is",
      paragraphs: [
        "Marites PH provides general information and planning tools for Philippine government processes. It is not a government website and is not affiliated with any government agency. We do not submit applications, book appointments, file tax returns, or issue invoices on your behalf.",
      ],
    },
    {
      heading: "Accuracy",
      paragraphs: [
        "We check official sources and show when each item was last verified, but government requirements and fees change. Always confirm with the agency before acting. Community tips are personal experiences and are not verified.",
      ],
    },
    {
      heading: "Your conduct",
      items: [
        "Do not post false information, personal data of others, or offensive content.",
        "Do not offer or advertise fixer services, paid appointment slots, or \"assistance\" outside official channels. We remove such content and may suspend accounts.",
        "Do not misuse the service, including automated scraping or attempts to bypass rate limits.",
      ],
    },
    {
      heading: "Paid plans",
      paragraphs: ["Paid plans will have separate billing terms shown before purchase. [TO REVIEW: Phase 8]"],
    },
    {
      heading: "Liability",
      paragraphs: [
        "To the extent allowed by law, we are not liable for losses from relying on information without confirming it with the responsible agency. [TO REVIEW: liability wording under Philippine law.]",
      ],
    },
    {
      heading: "Changes and contact",
      paragraphs: ["We may update these terms and will show the new date and version. Questions: [CONTACT EMAIL]."],
    },
  ],
  fil: [
    {
      heading: "Paalala",
      paragraphs: ["Buod ito sa Filipino. Ang bersyong Ingles ang masusunod habang hindi pa nasusuri ang salin. [TO REVIEW: buong salin]"],
    },
    {
      heading: "Ano ang Marites PH",
      paragraphs: [
        "Nagbibigay ang Marites PH ng pangkalahatang impormasyon at tools sa pagpaplano para sa mga proseso sa gobyerno. Hindi ito website ng gobyerno at hindi kaugnay ng anumang ahensya. Hindi kami nagsusumite ng application, nagbu-book ng appointment, nagfa-file ng tax return, o nag-iisyu ng resibo para sa iyo.",
      ],
    },
    {
      heading: "Bawal ang fixer",
      paragraphs: [
        "Bawal mag-alok ng fixer services, bayad na appointment slot, o \"assistance\" sa labas ng opisyal na proseso. Tatanggalin namin ang ganitong content at maaaring i-suspend ang account.",
      ],
    },
  ],
};
