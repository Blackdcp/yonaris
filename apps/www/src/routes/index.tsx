import { createFileRoute } from "@tanstack/react-router";
import { GlobalHomePage } from "@/components/experience/global/global-pages";
import { globalEnglishPageHead } from "@/editions/global-en/edition";

export const Route = createFileRoute("/")({ head: () => globalEnglishPageHead("home"), component: GlobalHomePage });
