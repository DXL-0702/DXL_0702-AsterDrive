import { describe, expect, it } from "vitest";
import {
	isPublicR2DevUrl,
	normalizeS3ConnectionFields,
} from "@/lib/s3Endpoint";

describe("normalizeS3ConnectionFields", () => {
	it("extracts a bucket from an R2 endpoint path", () => {
		expect(
			normalizeS3ConnectionFields(
				"https://demo-account.r2.cloudflarestorage.com/photos",
				"",
			),
		).toEqual({
			endpoint: "https://demo-account.r2.cloudflarestorage.com",
			bucket: "photos",
		});
	});

	it("keeps a matching bucket and normalizes the endpoint root", () => {
		expect(
			normalizeS3ConnectionFields(
				"https://demo-account.r2.cloudflarestorage.com/photos",
				"photos",
			),
		).toEqual({
			endpoint: "https://demo-account.r2.cloudflarestorage.com",
			bucket: "photos",
		});
	});

	it("does not overwrite a conflicting bucket value", () => {
		expect(
			normalizeS3ConnectionFields(
				"https://demo-account.r2.cloudflarestorage.com/photos",
				"videos",
			),
		).toEqual({
			endpoint: "https://demo-account.r2.cloudflarestorage.com/photos",
			bucket: "videos",
		});
	});

	it("does not rewrite non-R2 endpoints", () => {
		expect(
			normalizeS3ConnectionFields(
				"https://s3.example.com/custom/path",
				"archive",
			),
		).toEqual({
			endpoint: "https://s3.example.com/custom/path",
			bucket: "archive",
		});
	});
});

describe("isPublicR2DevUrl", () => {
	it("detects public r2.dev URLs", () => {
		expect(
			isPublicR2DevUrl("https://pub-dsaifhoiuahfas.r2.dev/aster-drive"),
		).toBe(true);
	});

	it("does not flag account-level R2 API endpoints", () => {
		expect(
			isPublicR2DevUrl("https://demo-account.r2.cloudflarestorage.com"),
		).toBe(false);
	});
});
