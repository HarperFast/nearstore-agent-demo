import js from '@eslint/js';
import globals from 'globals';

export default [
	js.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			ecmaVersion: 'latest',
			sourceType: 'module',
		},
		rules: {
			'no-unused-vars': 'warn',
			'no-console': 'off',
		},
	},
	{
		// web/ files run in the browser and use Leaflet (L) loaded via CDN <script>
		files: ['web/**/*.js'],
		languageOptions: {
			globals: {
				L: 'readonly',
			},
		},
	},
	{
		ignores: ['node_modules/'],
	},
];
