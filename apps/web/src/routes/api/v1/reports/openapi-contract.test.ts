import openApiSpec from "@workspace/api-spec";
import { describe, expect, it } from "vitest";

type LanguageSchema = {
	type: string;
	enum: string[];
	default?: string;
};

type ObjectSchema = {
	properties: Record<string, unknown>;
	required?: string[];
};

type ReportOpenApiSpec = {
	components: {
		schemas: {
			CreateReportRequest: ObjectSchema;
			ReportSummary: ObjectSchema;
		};
	};
	paths: {
		"/reports": {
			post: {
				responses: {
					"201": {
						content: {
							"application/json": { schema: ObjectSchema };
						};
					};
					"503": {
						content: {
							"application/json": {
								schema: ObjectSchema;
								example: Record<string, unknown>;
							};
						};
					};
				};
			};
		};
		"/reports/{reportId}": {
			get: {
				responses: {
					"200": {
						content: {
							"application/json": {
								schema: ObjectSchema;
								example: Record<string, unknown>;
							};
						};
					};
				};
			};
		};
	};
};

const spec = openApiSpec as unknown as ReportOpenApiSpec;

describe("reports OpenAPI output language contract", () => {
	it("documents outputLanguage as an optional bilingual request field defaulting to English", () => {
		const request = spec.components.schemas.CreateReportRequest;

		expect(request.properties.outputLanguage).toMatchObject({
			type: "string",
			enum: ["en", "zh-CN"],
			default: "en",
		} satisfies LanguageSchema);
		expect(request.required).not.toContain("outputLanguage");
	});

	it("requires outputLanguage in each report summary", () => {
		const summary = spec.components.schemas.ReportSummary;

		expect(summary.properties.outputLanguage).toMatchObject({
			type: "string",
			enum: ["en", "zh-CN"],
		} satisfies LanguageSchema);
		expect(summary.required).toContain("outputLanguage");
	});

	it("requires outputLanguage in the create-report response", () => {
		const response = spec.paths["/reports"].post.responses["201"].content["application/json"].schema;

		expect(response.properties.outputLanguage).toMatchObject({
			type: "string",
			enum: ["en", "zh-CN"],
		} satisfies LanguageSchema);
		expect(response.required).toContain("outputLanguage");
	});

	it("documents the stable machine code for disabled Chinese generation", () => {
		const response = spec.paths["/reports"].post.responses["503"].content["application/json"];

		expect(response.schema.properties.code).toMatchObject({
			type: "string",
			enum: ["report-output-language-temporarily-unavailable"],
		} satisfies LanguageSchema);
		expect(response.schema.required).toEqual(expect.arrayContaining(["error", "message", "code"]));
		expect(response.example.code).toBe("report-output-language-temporarily-unavailable");
	});

	it("requires outputLanguage in report detail responses and documents it in the completed example", () => {
		const response = spec.paths["/reports/{reportId}"].get.responses["200"].content["application/json"];

		expect(response.schema.properties.outputLanguage).toMatchObject({
			type: "string",
			enum: ["en", "zh-CN"],
		} satisfies LanguageSchema);
		expect(response.schema.required).toContain("outputLanguage");
		expect(response.example.outputLanguage).toBe("en");
	});
});
