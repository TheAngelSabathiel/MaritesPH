import { guidePage } from "@/components/public/guide-page";

/** Personal document guides (IDs, certificates, clearances). See guide-page.tsx. */
const page = guidePage("personal");
export const generateStaticParams = page.generateStaticParams;
export const generateMetadata = page.generateMetadata;
export default page.GuidePage;
