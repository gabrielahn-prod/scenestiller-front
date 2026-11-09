// Components.d.ts — the complete catalog of the 9 component(s) in
// Components.bundle.js. READ THIS FILE BEFORE USING THE BUNDLE: component
// names are derived from Figma layer names (sanitized to PascalCase,
// deduplicated) and may differ from what the design calls them — the
// "figma layer" comment above each interface maps them back.
// After the bundle <script> loads, every component is a window global
// (e.g. window.Button) and usable directly in JSX.
import * as React from 'react';

// figma layer: "button" (node 38:77)
export interface ButtonProps {
  className?: string;
  style?: React.CSSProperties;
  prop?: "default" | "loading";
  /** Text content; defaults to "로그인". */
  text1?: string;
}

// figma layer: "Component 1" (node 47:2117)
export interface Component1Props {
  className?: string;
  style?: React.CSSProperties;
  prop?: "전체" | "ai" | "사진";
  /** Text content; defaults to "전체 (5)". */
  text1?: string;
  /** Text content; defaults to "AI 텍스트 (3)". */
  text2?: string;
  /** Text content; defaults to "사진 근거 (2)". */
  text3?: string;
}

// figma layer: "icon-home-mono,home,family,roof,village" (node 118:1232)
export interface IconHomeMonoHomeFamilyProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "input" (node 30:106)
export interface InputProps {
  className?: string;
  style?: React.CSSProperties;
  prop?: "default" | "focused" | "typing" | "done" | "error";
  /** Text content; defaults to "아이디". */
  text1?: string;
  /** Text content; defaults to "아이디를 입력해주세요". */
  text2?: string;
  /** Text content; defaults to "아이디를 입력해주세요". */
  text3?: string;
}

// figma layer: "navigation bar" (node 118:1555)
export interface NavigationBarProps {
  className?: string;
  style?: React.CSSProperties;
  prop?: "홈" | "기록" | "설정";
  /** Text content; defaults to "홈". */
  text1?: string;
  /** Text content; defaults to "기록". */
  text2?: string;
  /** Text content; defaults to "설정". */
  text3?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "plan" (node 44:795)
export interface PlanProps {
  className?: string;
  style?: React.CSSProperties;
  prop?: "pro" | "premium";
  /** Text content; defaults to "Pro". */
  text1?: string;
}

// figma layer: "toggle switch" (node 119:2235)
export interface ToggleSwitchProps {
  className?: string;
  style?: React.CSSProperties;
  prop?: "on" | "off";
}

// figma layer: "top bar" (node 38:162)
export interface TopBarProps {
  className?: string;
  style?: React.CSSProperties;
  prop?: "내보고서" | "홈" | "업로드" | "내영상";
  /** Text content; defaults to "홈". */
  text1?: string;
  /** Text content; defaults to "업로드". */
  text2?: string;
  /** Text content; defaults to "내 영상". */
  text3?: string;
  /** Text content; defaults to "내 보고서". */
  text4?: string;
}

// figma layer: "top navagation bar" (node 44:909)
export interface TopNavagationBarProps {
  className?: string;
  style?: React.CSSProperties;
  /** Text content; defaults to "Scene Stealer". */
  text1?: string;
  /** Text content; defaults to "홍길동님". */
  text2?: string;
  /** Text content; defaults to "로그아웃". */
  text3?: string;
}

declare const Button: React.FC<ButtonProps>;
declare const Component1: React.FC<Component1Props>;
declare const IconHomeMonoHomeFamily: React.FC<IconHomeMonoHomeFamilyProps>;
declare const Input: React.FC<InputProps>;
declare const NavigationBar: React.FC<NavigationBarProps>;
declare const Plan: React.FC<PlanProps>;
declare const ToggleSwitch: React.FC<ToggleSwitchProps>;
declare const TopBar: React.FC<TopBarProps>;
declare const TopNavagationBar: React.FC<TopNavagationBarProps>;
declare global {
  interface Window {
    Button: React.FC<ButtonProps>;
    Component1: React.FC<Component1Props>;
    IconHomeMonoHomeFamily: React.FC<IconHomeMonoHomeFamilyProps>;
    Input: React.FC<InputProps>;
    NavigationBar: React.FC<NavigationBarProps>;
    Plan: React.FC<PlanProps>;
    ToggleSwitch: React.FC<ToggleSwitchProps>;
    TopBar: React.FC<TopBarProps>;
    TopNavagationBar: React.FC<TopNavagationBarProps>;
  }
}
