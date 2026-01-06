import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: true,
	prerender: false, // Disable prerender to avoid serialization issues during build
} satisfies Config;
