import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { adminUserService } from "@/services/adminService";
import { handleApiError } from "@/hooks/useApiError";
import type { UserInfo, UserRole, UserStatus } from "@/types/api";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export default function AdminUsersPage() {
	const [users, setUsers] = useState<UserInfo[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const data = await adminUserService.list();
			setUsers(data);
		} catch (e) {
			handleApiError(e);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const updateRole = async (id: number, role: UserRole) => {
		try {
			const updated = await adminUserService.update(id, { role });
			setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
			toast.success("Role updated");
		} catch (e) {
			handleApiError(e);
		}
	};

	const updateStatus = async (id: number, status: UserStatus) => {
		try {
			const updated = await adminUserService.update(id, { status });
			setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
			toast.success("Status updated");
		} catch (e) {
			handleApiError(e);
		}
	};

	return (
		<AdminLayout>
			<div className="p-6 space-y-4">
				<h2 className="text-lg font-semibold">Users</h2>
				<ScrollArea className="flex-1">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-16">ID</TableHead>
								<TableHead>Username</TableHead>
								<TableHead>Email</TableHead>
								<TableHead className="w-32">Role</TableHead>
								<TableHead className="w-32">Status</TableHead>
								<TableHead>Created</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : users.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="text-center text-muted-foreground"
									>
										No users
									</TableCell>
								</TableRow>
							) : (
								users.map((user) => (
									<TableRow key={user.id}>
										<TableCell className="font-mono text-xs">
											{user.id}
										</TableCell>
										<TableCell className="font-medium">
											{user.username}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{user.email}
										</TableCell>
										<TableCell>
											<Select
												value={user.role}
												onValueChange={(v) =>
													updateRole(user.id, v as UserRole)
												}
											>
												<SelectTrigger className="h-8 w-24">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="admin">Admin</SelectItem>
													<SelectItem value="user">User</SelectItem>
												</SelectContent>
											</Select>
										</TableCell>
										<TableCell>
											<Select
												value={user.status}
												onValueChange={(v) =>
													updateStatus(user.id, v as UserStatus)
												}
											>
												<SelectTrigger className="h-8 w-28">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="active">
														<Badge
															variant="outline"
															className="text-green-600 border-green-600"
														>
															Active
														</Badge>
													</SelectItem>
													<SelectItem value="disabled">
														<Badge
															variant="outline"
															className="text-red-600 border-red-600"
														>
															Disabled
														</Badge>
													</SelectItem>
												</SelectContent>
											</Select>
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">
											{new Date(user.created_at).toLocaleDateString()}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</ScrollArea>
			</div>
		</AdminLayout>
	);
}
