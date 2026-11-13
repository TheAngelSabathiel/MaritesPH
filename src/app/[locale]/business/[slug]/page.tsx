import { guidePage } from "@/components/public/guide-page";

/** Business and freelancer guides (BIR registration, books, invoices, filing). See guide-page.tsx. */
const page = guidePage("business");
export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.GuidePage;
