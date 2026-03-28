import type { ComponentType } from "react";
import AngularPlainIcon from "react-devicons/angular/plain";
import AstroPlainIcon from "react-devicons/astro/plain";
import BashPlainIcon from "react-devicons/bash/plain";
import CPlainIcon from "react-devicons/c/plain";
import ClojureOriginalIcon from "react-devicons/clojure/original";
import CoffeescriptOriginalIcon from "react-devicons/coffeescript/original";
import CplusplusPlainIcon from "react-devicons/cplusplus/plain";
import CsharpPlainIcon from "react-devicons/csharp/plain";
import Css3PlainIcon from "react-devicons/css3/plain";
import DartPlainIcon from "react-devicons/dart/plain";
import DockerPlainIcon from "react-devicons/docker/plain";
import ElixirPlainIcon from "react-devicons/elixir/plain";
import ErlangPlainIcon from "react-devicons/erlang/plain";
import GoPlainIcon from "react-devicons/go/plain";
import GradleOriginalIcon from "react-devicons/gradle/original";
import GraphqlPlainIcon from "react-devicons/graphql/plain";
import GroovyPlainIcon from "react-devicons/groovy/plain";
import GrpcPlainIcon from "react-devicons/grpc/plain";
import HaskellPlainIcon from "react-devicons/haskell/plain";
import Html5PlainIcon from "react-devicons/html5/plain";
import JavaPlainIcon from "react-devicons/java/plain";
import JavascriptPlainIcon from "react-devicons/javascript/plain";
import JsonPlainIcon from "react-devicons/json/plain";
import JuliaPlainIcon from "react-devicons/julia/plain";
import KotlinPlainIcon from "react-devicons/kotlin/plain";
import LatexOriginalIcon from "react-devicons/latex/original";
import LuaPlainIcon from "react-devicons/lua/plain";
import MarkdownOriginalIcon from "react-devicons/markdown/original";
import NginxOriginalIcon from "react-devicons/nginx/original";
import NimPlainIcon from "react-devicons/nim/plain";
import NodejsPlainIcon from "react-devicons/nodejs/plain";
import PerlPlainIcon from "react-devicons/perl/plain";
import PhpPlainIcon from "react-devicons/php/plain";
import PowershellPlainIcon from "react-devicons/powershell/plain";
import PythonPlainIcon from "react-devicons/python/plain";
import RPlainIcon from "react-devicons/r/plain";
import ReactOriginalIcon from "react-devicons/react/original";
import RubyPlainIcon from "react-devicons/ruby/plain";
import RustOriginalIcon from "react-devicons/rust/original";
import SassOriginalIcon from "react-devicons/sass/original";
import ScalaPlainIcon from "react-devicons/scala/plain";
import SolidityPlainIcon from "react-devicons/solidity/plain";
import SqlitePlainIcon from "react-devicons/sqlite/plain";
import SveltePlainIcon from "react-devicons/svelte/plain";
import SwiftPlainIcon from "react-devicons/swift/plain";
import TerraformPlainIcon from "react-devicons/terraform/plain";
import TypescriptPlainIcon from "react-devicons/typescript/plain";
import VuejsOriginalIcon from "react-devicons/vuejs/original";
import XmlPlainIcon from "react-devicons/xml/plain";
import YamlPlainIcon from "react-devicons/yaml/plain";
import ZigOriginalIcon from "react-devicons/zig/plain-wordmark";

export type DevIconComponent = ComponentType<{ size?: string | number }>;

const LANGUAGE_ICON_MAP: Record<string, DevIconComponent> = {
	// Web
	js: JavascriptPlainIcon,
	jsx: JavascriptPlainIcon,
	mjs: JavascriptPlainIcon,
	cjs: JavascriptPlainIcon,
	ts: TypescriptPlainIcon,
	tsx: TypescriptPlainIcon,
	vue: VuejsOriginalIcon,
	svelte: SveltePlainIcon,
	astro: AstroPlainIcon,
	html: Html5PlainIcon,
	htm: Html5PlainIcon,
	css: Css3PlainIcon,
	scss: SassOriginalIcon,
	less: SassOriginalIcon,
	svg: XmlPlainIcon,
	// Data / markup
	json: JsonPlainIcon,
	xml: XmlPlainIcon,
	yaml: YamlPlainIcon,
	yml: YamlPlainIcon,
	md: MarkdownOriginalIcon,
	markdown: MarkdownOriginalIcon,
	rst: MarkdownOriginalIcon,
	tex: LatexOriginalIcon,
	bib: LatexOriginalIcon,
	sql: SqlitePlainIcon,
	// Systems
	c: CPlainIcon,
	h: CPlainIcon,
	cpp: CplusplusPlainIcon,
	hpp: CplusplusPlainIcon,
	cs: CsharpPlainIcon,
	rs: RustOriginalIcon,
	go: GoPlainIcon,
	dart: DartPlainIcon,
	zig: ZigOriginalIcon,
	nim: NimPlainIcon,
	swift: SwiftPlainIcon,
	// JVM
	java: JavaPlainIcon,
	kt: KotlinPlainIcon,
	kts: KotlinPlainIcon,
	scala: ScalaPlainIcon,
	groovy: GroovyPlainIcon,
	clj: ClojureOriginalIcon,
	cljs: ClojureOriginalIcon,
	// Scripting
	py: PythonPlainIcon,
	rb: RubyPlainIcon,
	php: PhpPlainIcon,
	pl: PerlPlainIcon,
	pm: PerlPlainIcon,
	lua: LuaPlainIcon,
	r: RPlainIcon,
	jl: JuliaPlainIcon,
	coffee: CoffeescriptOriginalIcon,
	// Shell
	sh: BashPlainIcon,
	bash: BashPlainIcon,
	zsh: BashPlainIcon,
	fish: BashPlainIcon,
	ps1: PowershellPlainIcon,
	psm1: PowershellPlainIcon,
	bat: BashPlainIcon,
	cmd: BashPlainIcon,
	// Functional
	hs: HaskellPlainIcon,
	ex: ElixirPlainIcon,
	exs: ElixirPlainIcon,
	erl: ErlangPlainIcon,
	// Schema / query
	graphql: GraphqlPlainIcon,
	gql: GraphqlPlainIcon,
	proto: GrpcPlainIcon,
	// IaC / config
	tf: TerraformPlainIcon,
	tfvars: TerraformPlainIcon,
	hcl: TerraformPlainIcon,
	gradle: GradleOriginalIcon,
	// Web3
	sol: SolidityPlainIcon,
	// Infrastructure
	nginx: NginxOriginalIcon,
	// Frameworks
	react: ReactOriginalIcon,
	angular: AngularPlainIcon,
	nodejs: NodejsPlainIcon,
};

const SPECIAL_FILENAME_MAP: Record<string, DevIconComponent> = {
	dockerfile: DockerPlainIcon,
	".dockerignore": DockerPlainIcon,
	jenkinsfile: GroovyPlainIcon,
	vagrantfile: RubyPlainIcon,
	gemfile: RubyPlainIcon,
	rakefile: RubyPlainIcon,
	".npmrc": NginxOriginalIcon,
	".editorconfig": NginxOriginalIcon,
};

function getExtension(name: string) {
	const lower = name.trim().toLowerCase();
	const special = SPECIAL_FILENAME_MAP[lower];
	if (special) return { ext: lower, specialIcon: special };
	const dot = lower.lastIndexOf(".");
	if (dot < 0) return { ext: "", specialIcon: null };
	return { ext: lower.slice(dot + 1), specialIcon: null };
}

export function resolveIcon(name: string): DevIconComponent | null {
	const { ext, specialIcon } = getExtension(name);
	if (specialIcon) return specialIcon;
	return LANGUAGE_ICON_MAP[ext] ?? null;
}

export function checkHasIcon(name: string): boolean {
	return resolveIcon(name) !== null;
}
