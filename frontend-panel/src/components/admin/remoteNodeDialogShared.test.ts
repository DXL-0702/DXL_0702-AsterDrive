import { describe, expect, it } from "vitest";
import {
	buildCreateRemoteNodePayload,
	buildUpdateRemoteNodePayload,
	getRemoteNodeForm,
} from "@/components/admin/remoteNodeDialogShared";
import type { RemoteNodeInfo } from "@/types/api";

describe("remoteNodeDialogShared", () => {
	it("maps an existing remote node into form state", () => {
		expect(
			getRemoteNodeForm({
				id: 4,
				name: "Edge Alpha",
				base_url: "https://remote.example.com",
				namespace: "tenant-a",
				is_enabled: true,
				last_error: "",
				last_checked_at: null,
				capabilities: {
					protocol_version: "v1",
					supports_list: true,
					supports_range_read: true,
					supports_stream_upload: true,
				},
				created_at: "",
				updated_at: "",
			} as RemoteNodeInfo),
		).toEqual({
			name: "Edge Alpha",
			base_url: "https://remote.example.com",
			namespace: "tenant-a",
			is_enabled: true,
		});
	});

	it("builds create payloads", () => {
		expect(
			buildCreateRemoteNodePayload({
				name: "Edge Alpha",
				base_url: "https://remote.example.com",
				namespace: "tenant-a",
				is_enabled: true,
			}),
		).toEqual({
			name: "Edge Alpha",
			base_url: "https://remote.example.com",
			namespace: "tenant-a",
			is_enabled: true,
		});
	});

	it("builds update payloads without managed credentials", () => {
		expect(
			buildUpdateRemoteNodePayload({
				name: "Edge Alpha",
				base_url: "",
				namespace: "tenant-b",
				is_enabled: false,
			}),
		).toEqual({
			name: "Edge Alpha",
			base_url: "",
			namespace: "tenant-b",
			is_enabled: false,
		});
	});
});
