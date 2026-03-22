import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "@/router";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";

function App() {
	const checkAuth = useAuthStore((s) => s.checkAuth);

	useEffect(() => {
		checkAuth();
		useThemeStore.getState().init();
	}, [checkAuth]);

	return (
		<>
			<RouterProvider router={router} />
			<Toaster position="top-right" richColors />
		</>
	);
}

export default App;
