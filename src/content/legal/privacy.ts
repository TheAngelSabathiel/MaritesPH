import type { LegalDoc } from "./types";

// TO REVIEW: privacy policy draft aligned with RA 10173 (Data Privacy Act of 2012).
export const privacyPolicy: LegalDoc = {
  en: [
    {
      heading: "Who we are",
      paragraphs: [
        "Marites PH is operated by [OPERATOR NAME], [BUSINESS ADDRESS], Philippines (\"we\"). We are the personal information controller for data you give us through this website.",
        "Data Protection Officer: [DPO NAME], [DPO EMAIL].",
      ],
    },
    {
      heading: "What we collect",
      items: [
        "Account data: your email address, and your name if you sign in with Google.",
        "Preferences you choose to give: display name, preferred language, region and city.",
        "Records of your consent: the date and the version of this policy you agreed to.",
        "Technical data needed to run the service securely, such as sign-in session cookies and server logs.",
        "Later features (only when you use them, and only with notice): documents you track, saved plans, and, for paid tax tools, income and expense entries and taxpayer details. Sensitive financial fields will be encrypted.",
      ],
    },
    {
      heading: "Why we use it",
      items: [
        "To provide your account, saved plans, and reminders you ask for.",
        "To keep the service secure and prevent abuse (for example, rate limiting).",
        "To improve guides using aggregated, non-identifying information.",
      ],
      paragraphs: [
        "Our basis for processing is your consent, given when you create an account, and our need to perform the service you requested. We collect only what we need.",
      ],
    },
    {
      heading: "Who processes data for us",
      paragraphs: [
        "We use service providers who process data on our behalf under contract: Supabase (database and sign-in), Vercel (hosting), and, in later features, Anthropic (AI processing of questions you submit, without your account details), Resend (email), and PayMongo (payments). Some of these providers store data outside the Philippines. [TO REVIEW: list exact regions and cross-border transfer safeguards.]",
        "We do not sell your personal data. We do not show ads.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "We keep account data while your account is active. When you delete your account, we delete your personal data within [NUMBER] days, except records we are required by law to keep. [TO REVIEW: retention periods.]",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: ["Under the Data Privacy Act of 2012, you have the right to:"],
      items: [
        "Be informed about how your data is processed.",
        "Access a copy of your data, and receive it in a portable format.",
        "Correct inaccurate data.",
        "Object to processing, and withdraw consent.",
        "Have your data erased or blocked.",
        "Be compensated for damages from inaccurate or unauthorized use.",
        "File a complaint with the National Privacy Commission (privacy.gov.ph).",
      ],
    },
    {
      heading: "Contact",
      paragraphs: ["To exercise these rights or ask questions, email [DPO EMAIL]. We will respond within [NUMBER] days."],
    },
  ],
  fil: [
    {
      heading: "Paalala",
      paragraphs: [
        "Ito ay buod sa Filipino ng aming Privacy Policy. Ang bersyong Ingles ang masusunod habang hindi pa nasusuri ang salin. [TO REVIEW: buong salin]",
      ],
    },
    {
      heading: "Sino kami",
      paragraphs: [
        "Ang Marites PH ay pinapatakbo ng [OPERATOR NAME], [BUSINESS ADDRESS], Pilipinas. Kami ang personal information controller ng datos na ibinibigay mo sa website na ito. Data Protection Officer: [DPO NAME], [DPO EMAIL].",
      ],
    },
    {
      heading: "Anong datos ang kinokolekta namin",
      items: [
        "Email address, at pangalan kung mag-sign in ka gamit ang Google.",
        "Mga piniling preference: display name, wika, rehiyon at lungsod.",
        "Record ng iyong pagpayag: petsa at bersyon ng policy na ito.",
        "Teknikal na datos para ligtas na tumakbo ang serbisyo, gaya ng session cookies.",
      ],
    },
    {
      heading: "Ang iyong mga karapatan",
      items: [
        "Malaman kung paano pinoproseso ang iyong datos.",
        "Makakuha ng kopya ng iyong datos.",
        "Ipaayos ang maling datos.",
        "Tumutol at bawiin ang pagpayag.",
        "Ipabura ang iyong datos.",
        "Magreklamo sa National Privacy Commission (privacy.gov.ph).",
      ],
    },
    {
      heading: "Makipag-ugnayan",
      paragraphs: ["Mag-email sa [DPO EMAIL]."],
    },
  ],
};
