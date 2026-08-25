import { createFileRoute } from "@tanstack/react-router";
import { GlobalGeoPage } from "@/components/experience/global/global-pages";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/geo")({ head: () => globalEnglishPageHead("geo"), component: GlobalGeoPage });
