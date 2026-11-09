// Components bundle — 9 component(s) materialized from a .fig as one
// self-contained file: no imports/exports; every component is assigned to window below.
// Design tokens / typography still ship separately (fig-tokens.css / fig-typography.css).

// figma node: 38:77 button (2 variants)
const __venc_Button = v => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey_Button = p => "prop=" + __venc_Button(p.prop);
function Button(_p = {}) {
  const props = {
    ..._p,
    prop: _p.prop ?? "default"
  };
  const __body0 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 680,
      height: 80,
      borderRadius: 12,
      backgroundColor: "var(--main)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 10px 10px 10px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      textAlign: "center",
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "rgb(255,255,255)",
      flexShrink: 0
    }
  }, props.text1 ?? "로그인"));
  const __body1 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 680,
      height: 80,
      borderRadius: 12,
      backgroundColor: "var(--border-dafault)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 10px 10px 10px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      textAlign: "center",
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "rgb(255,255,255)",
      flexShrink: 0
    }
  }, props.text1 ?? "로그인중..."));
  const __impls = {
    // figma: 속성 1=default
    "prop=default": __body0,
    // figma: 속성 1=loading
    "prop=loading": __body1
  };
  return (__impls[__vkey_Button(props)] ?? __body0)();
}

// figma node: 30:106 input (5 variants)
const __venc_Input = v => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey_Input = p => "prop=" + __venc_Input(p.prop);
function Input(_p = {}) {
  const props = {
    ..._p,
    prop: _p.prop ?? "default"
  };
  const __body0 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 680,
      display: "flex",
      flexDirection: "column",
      gap: 20,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "아이디"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 80,
      borderRadius: 12,
      backgroundColor: "var(--bg)",
      boxShadow: "inset 0 0 0 1px var(--border-strong-2)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 10px 10px 20px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 24,
      textAlign: "center",
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-secondary-2)",
      flexShrink: 0
    }
  }, props.text2 ?? "아이디를 입력해주세요")));
  const __body1 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 680,
      display: "flex",
      flexDirection: "column",
      gap: 20,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "아이디"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 80,
      borderRadius: 12,
      backgroundColor: "var(--bg)",
      boxShadow: "inset 0 0 0 1px var(--border-focus)",
      display: "flex",
      flexDirection: "row",
      padding: "10px 10px 10px 20px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 1.992,
      height: 30,
      borderRadius: 99,
      backgroundColor: "var(--sub)",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 24,
      textAlign: "center",
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0
    }
  }, props.text2 ?? "sodam7376")));
  const __body2 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 680,
      display: "flex",
      flexDirection: "column",
      gap: 20,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "아이디"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 80,
      borderRadius: 12,
      backgroundColor: "var(--bg)",
      boxShadow: "inset 0 0 0 1px var(--border-error-2)",
      display: "flex",
      flexDirection: "row",
      padding: "10px 10px 10px 20px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 24,
      textAlign: "center",
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-secondary-2)",
      flexShrink: 0
    }
  }, props.text2 ?? "아이디를 입력해주세요")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 145,
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "0px 4px 0px 4px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      textAlign: "center",
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-error-2)",
      flexShrink: 0
    }
  }, props.text3 ?? "아이디를 입력해주세요"))));
  const __body3 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 680,
      display: "flex",
      flexDirection: "column",
      gap: 20,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "아이디"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 80,
      borderRadius: 12,
      backgroundColor: "var(--bg)",
      boxShadow: "inset 0 0 0 1px var(--border-focus)",
      display: "flex",
      flexDirection: "row",
      padding: "10px 10px 10px 20px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 24,
      textAlign: "center",
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0
    }
  }, props.text2 ?? "sodam7376"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 1.992,
      height: 30,
      borderRadius: 99,
      backgroundColor: "var(--sub)",
      flexShrink: 0
    }
  })));
  const __body4 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 680,
      display: "flex",
      flexDirection: "column",
      gap: 20,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "아이디"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 80,
      borderRadius: 12,
      backgroundColor: "var(--bg)",
      boxShadow: "inset 0 0 0 1px var(--text-secondary-2)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 10px 10px 20px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 24,
      textAlign: "center",
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0
    }
  }, props.text2 ?? "sodam7376")));
  const __impls = {
    // figma: 속성 1=default
    "prop=default": __body0,
    // figma: 속성 1=focused
    "prop=focused": __body1,
    // figma: 속성 1=error
    "prop=error": __body2,
    // figma: 속성 1=typing
    "prop=typing": __body3,
    // figma: 속성 1=done
    "prop=done": __body4
  };
  return (__impls[__vkey_Input(props)] ?? __body0)();
}

// figma node: 38:162 top bar (4 variants)
const __venc_TopBar = v => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey_TopBar = p => "prop=" + __venc_TopBar(p.prop);
function TopBar(_p = {}) {
  const props = {
    ..._p,
    prop: _p.prop ?? "내보고서"
  };
  const __body0 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: "fit-content",
      display: "flex",
      flexDirection: "row",
      gap: 44,
      alignItems: "center",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--sub)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text1 ?? "홈"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text2 ?? "업로드"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text3 ?? "내 영상"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text4 ?? "내 보고서"));
  const __body1 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: "fit-content",
      display: "flex",
      flexDirection: "row",
      gap: 44,
      alignItems: "center",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text1 ?? "홈"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text2 ?? "업로드"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text3 ?? "내 영상"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--sub)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text4 ?? "내 보고서"));
  const __body2 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: "fit-content",
      display: "flex",
      flexDirection: "row",
      gap: 44,
      alignItems: "center",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text1 ?? "홈"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text2 ?? "업로드"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--sub)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text3 ?? "내 영상"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text4 ?? "내 보고서"));
  const __body3 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: "fit-content",
      display: "flex",
      flexDirection: "row",
      gap: 44,
      alignItems: "center",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text1 ?? "홈"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--sub)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text2 ?? "업로드"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text3 ?? "내 영상"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text4 ?? "내 보고서"));
  const __impls = {
    // figma: 속성 1=홈
    "prop=홈": __body0,
    // figma: 속성 1=내보고서
    "prop=내보고서": __body1,
    // figma: 속성 1=내영상
    "prop=내영상": __body2,
    // figma: 속성 1=업로드
    "prop=업로드": __body3
  };
  return (__impls[__vkey_TopBar(props)] ?? __body1)();
}

// figma node: 44:795 plan (2 variants)
const __venc_Plan = v => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey_Plan = p => "prop=" + __venc_Plan(p.prop);
function Plan(_p = {}) {
  const props = {
    ..._p,
    prop: _p.prop ?? "pro"
  };
  const __body0 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 80,
      height: 40,
      borderRadius: 99,
      backgroundColor: "var(--blue-100)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 30px 10px 30px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 20,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--sub)",
      flexShrink: 0
    }
  }, props.text1 ?? "Pro"));
  const __body1 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: "fit-content",
      height: 40,
      borderRadius: 99,
      backgroundColor: "var(--blue-100)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 30px 10px 30px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 20,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--sub)",
      flexShrink: 0
    }
  }, props.text1 ?? "Premium"));
  const __impls = {
    // figma: 속성 1=pro
    "prop=pro": __body0,
    // figma: 속성 1=premium
    "prop=premium": __body1
  };
  return (__impls[__vkey_Plan(props)] ?? __body0)();
}

// figma node: 119:2235 toggle switch (2 variants)
const __venc_ToggleSwitch = v => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey_ToggleSwitch = p => "prop=" + __venc_ToggleSwitch(p.prop);
function ToggleSwitch(_p = {}) {
  const props = {
    ..._p,
    prop: _p.prop ?? "on"
  };
  const __body0 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 25.6,
      height: 16,
      borderRadius: 63.36000442504883,
      backgroundColor: "var(--sub)",
      display: "flex",
      flexDirection: "row",
      gap: 6.40000057220459,
      padding: "6.400px 1.920px 6.400px 1.280px",
      justifyContent: "flex-end",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 11.52,
      height: 11.52,
      borderRadius: "50%",
      backgroundColor: "var(--bg-2)",
      flexShrink: 0
    }
  }));
  const __body1 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 25.6,
      height: 16,
      borderRadius: 63.36000442504883,
      backgroundColor: "var(--border-strong-2)",
      display: "flex",
      flexDirection: "row",
      gap: 6.40000057220459,
      padding: "6.400px 1.920px 6.400px 1.280px",
      justifyContent: "flex-end",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 11.52,
      height: 11.52,
      borderRadius: "50%",
      backgroundColor: "var(--bg-2)",
      flexShrink: 0
    }
  }));
  const __impls = {
    // figma: 속성 1=on
    "prop=on": __body0,
    // figma: 속성 1=off
    "prop=off": __body1
  };
  return (__impls[__vkey_ToggleSwitch(props)] ?? __body0)();
}

// figma node: 118:1232 icon-home-mono,home,family,roof,village
function IconHomeMonoHomeFamily(_p = {}) {
  const props = _p;
  return /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 32,
      height: 32,
      overflow: "hidden",
      position: "relative",
      color: "rgb(232,180,180)",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 26.199,
    height: 27.090,
    viewBox: "0 0 26.199 27.090",
    fill: "none",
    style: {
      position: "absolute",
      left: 2.901,
      top: 1.693,
      width: 26.199,
      height: 27.09
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 25.192 9.246 L 13.929 0.29 C 13.694 0.102 13.401 0 13.1 0 C 12.799 0 12.506 0.102 12.271 0.29 L 1.007 9.246 C 0.693 9.496 0.439 9.813 0.265 10.174 C 0.091 10.536 0 10.932 0 11.333 L 0 23.89 C 0 24.739 0.337 25.553 0.937 26.153 C 1.537 26.753 2.351 27.09 3.2 27.09 L 10.433 27.09 L 10.433 20.754 C 10.433 20.4 10.574 20.061 10.824 19.811 C 11.074 19.561 11.413 19.421 11.767 19.421 L 14.433 19.421 C 14.787 19.421 15.126 19.561 15.376 19.811 C 15.626 20.061 15.767 20.4 15.767 20.754 L 15.767 27.09 L 22.999 27.09 C 23.847 27.09 24.661 26.753 25.261 26.153 C 25.862 25.553 26.199 24.739 26.199 23.89 L 26.199 11.334 C 26.199 10.933 26.108 10.537 25.934 10.176 C 25.759 9.814 25.506 9.496 25.192 9.246 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })));
}

// figma node: 118:1555 navigation bar (3 variants)
const __venc_NavigationBar = v => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey_NavigationBar = p => "prop=" + __venc_NavigationBar(p.prop);
function NavigationBar(_p = {}) {
  const props = {
    ..._p,
    prop: _p.prop ?? "홈"
  };
  const __body0 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 393,
      borderRadius: "16px 16px 0px 0px",
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "0px -2px 4px 0px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "row",
      padding: "16px 60px 28px 60px",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      color: "var(--text-secondary-2)",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      flexShrink: 0,
      color: "var(--sub)"
    }
  }, props.icon1 ?? /*#__PURE__*/React.createElement(IconHomeMonoHomeFamily, {
    style: {
      transform: "scale(0.750, 0.750)",
      transformOrigin: "0 0"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--sub)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "홈")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      overflow: "hidden",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16.500,
    height: 21,
    viewBox: "0 0 16.500 21",
    fill: "none",
    style: {
      position: "absolute",
      left: 3.75,
      top: 1.5,
      width: 16.5,
      height: 21
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 1.875 0 C 0.839 0 0 0.84 0 1.875 L 0 19.125 C 0 20.16 0.84 21 1.875 21 L 14.625 21 C 15.66 21 16.5 20.16 16.5 19.125 L 16.5 11.25 C 16.5 10.255 16.105 9.302 15.402 8.598 C 14.698 7.895 13.745 7.5 12.75 7.5 L 10.875 7.5 C 10.378 7.5 9.901 7.302 9.549 6.951 C 9.198 6.599 9 6.122 9 5.625 L 9 3.75 C 9 2.755 8.605 1.802 7.902 1.098 C 7.198 0.395 6.245 0 5.25 0 L 1.875 0 Z M 3.75 13.5 C 3.75 13.301 3.829 13.11 3.97 12.97 C 4.11 12.829 4.301 12.75 4.5 12.75 L 12 12.75 C 12.199 12.75 12.39 12.829 12.53 12.97 C 12.671 13.11 12.75 13.301 12.75 13.5 C 12.75 13.699 12.671 13.89 12.53 14.03 C 12.39 14.171 12.199 14.25 12 14.25 L 4.5 14.25 C 4.301 14.25 4.11 14.171 3.97 14.03 C 3.829 13.89 3.75 13.699 3.75 13.5 Z M 4.5 15.75 C 4.301 15.75 4.11 15.829 3.97 15.97 C 3.829 16.11 3.75 16.301 3.75 16.5 C 3.75 16.699 3.829 16.89 3.97 17.03 C 4.11 17.171 4.301 17.25 4.5 17.25 L 8.25 17.25 C 8.449 17.25 8.64 17.171 8.78 17.03 C 8.921 16.89 9 16.699 9 16.5 C 9 16.301 8.921 16.11 8.78 15.97 C 8.64 15.829 8.449 15.75 8.25 15.75 L 4.5 15.75 Z",
    fill: "currentColor",
    fillRule: "evenodd"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 6.963,
    height: 6.963,
    viewBox: "0 0 6.963 6.963",
    fill: "none",
    style: {
      position: "absolute",
      left: 12.971,
      top: 1.816,
      width: 6.963,
      height: 6.963
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 0 C 0.827 0.953 1.281 2.173 1.279 3.434 L 1.279 5.309 C 1.279 5.516 1.447 5.684 1.654 5.684 L 3.529 5.684 C 4.79 5.682 6.01 6.136 6.963 6.963 C 6.523 5.29 5.647 3.763 4.423 2.54 C 3.2 1.316 1.673 0.44 0 0 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--gray-700)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text2 ?? "기록")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      overflow: "hidden",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 18.312,
    height: 19.500,
    viewBox: "0 0 18.312 19.500",
    fill: "none",
    style: {
      position: "absolute",
      left: 2.845,
      top: 2.25,
      width: 18.312,
      height: 19.5
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 8.233 0 C 7.316 0 6.534 0.663 6.383 1.567 L 6.205 2.639 C 6.185 2.759 6.09 2.899 5.908 2.987 C 5.566 3.152 5.236 3.342 4.922 3.557 C 4.756 3.672 4.588 3.683 4.472 3.64 L 3.455 3.258 C 3.039 3.102 2.582 3.099 2.164 3.249 C 1.746 3.399 1.395 3.692 1.173 4.077 L 0.251 5.674 C 0.029 6.058 -0.049 6.509 0.03 6.946 C 0.109 7.382 0.341 7.777 0.683 8.059 L 1.523 8.751 C 1.618 8.829 1.693 8.98 1.677 9.181 C 1.649 9.56 1.649 9.941 1.677 10.32 C 1.692 10.52 1.618 10.672 1.524 10.75 L 0.683 11.442 C 0.341 11.724 0.109 12.119 0.03 12.555 C -0.049 12.992 0.029 13.443 0.251 13.827 L 1.173 15.424 C 1.395 15.808 1.746 16.102 2.164 16.251 C 2.582 16.401 3.04 16.398 3.455 16.242 L 4.474 15.86 C 4.589 15.817 4.757 15.829 4.924 15.942 C 5.236 16.156 5.565 16.347 5.909 16.512 C 6.091 16.6 6.186 16.74 6.206 16.862 L 6.384 17.933 C 6.535 18.837 7.317 19.5 8.234 19.5 L 10.078 19.5 C 10.994 19.5 11.777 18.837 11.928 17.933 L 12.106 16.861 C 12.126 16.741 12.22 16.601 12.403 16.512 C 12.747 16.347 13.076 16.156 13.388 15.942 C 13.555 15.828 13.723 15.817 13.838 15.86 L 14.858 16.242 C 15.274 16.397 15.731 16.4 16.148 16.25 C 16.566 16.1 16.916 15.807 17.138 15.423 L 18.061 13.826 C 18.283 13.442 18.361 12.991 18.282 12.554 C 18.203 12.118 17.972 11.723 17.629 11.441 L 16.789 10.749 C 16.694 10.671 16.619 10.52 16.635 10.319 C 16.664 9.94 16.664 9.559 16.635 9.18 C 16.619 8.98 16.694 8.828 16.788 8.75 L 17.628 8.058 C 18.336 7.476 18.519 6.468 18.061 5.673 L 17.139 4.076 C 16.917 3.692 16.566 3.398 16.148 3.249 C 15.73 3.099 15.273 3.102 14.857 3.258 L 13.837 3.64 C 13.723 3.683 13.555 3.671 13.388 3.557 C 13.075 3.342 12.746 3.152 12.403 2.987 C 12.22 2.9 12.126 2.76 12.106 2.639 L 11.927 1.567 C 11.854 1.129 11.628 0.731 11.29 0.444 C 10.951 0.157 10.521 0 10.077 0 L 8.234 0 L 8.233 0 Z M 9.155 13.5 C 10.15 13.5 11.104 13.105 11.807 12.402 C 12.51 11.698 12.905 10.745 12.905 9.75 C 12.905 8.755 12.51 7.802 11.807 7.098 C 11.104 6.395 10.15 6 9.155 6 C 8.161 6 7.207 6.395 6.504 7.098 C 5.8 7.802 5.405 8.755 5.405 9.75 C 5.405 10.745 5.8 11.698 6.504 12.402 C 7.207 13.105 8.161 13.5 9.155 13.5 Z",
    fill: "currentColor",
    fillRule: "evenodd"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--gray-700)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text3 ?? "설정")));
  const __body1 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 393,
      borderRadius: "16px 16px 0px 0px",
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "0px -2px 4px 0px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "row",
      padding: "16px 60px 28px 60px",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      flexShrink: 0,
      color: "var(--text-secondary-2)"
    }
  }, props.icon1 ?? /*#__PURE__*/React.createElement(IconHomeMonoHomeFamily, {
    style: {
      transform: "scale(0.750, 0.750)",
      transformOrigin: "0 0"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--gray-700)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "홈")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      overflow: "hidden",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16.500,
    height: 21,
    viewBox: "0 0 16.500 21",
    fill: "none",
    style: {
      position: "absolute",
      left: 3.75,
      top: 1.5,
      width: 16.5,
      height: 21,
      color: "var(--sub)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 1.875 0 C 0.839 0 0 0.84 0 1.875 L 0 19.125 C 0 20.16 0.84 21 1.875 21 L 14.625 21 C 15.66 21 16.5 20.16 16.5 19.125 L 16.5 11.25 C 16.5 10.255 16.105 9.302 15.402 8.598 C 14.698 7.895 13.745 7.5 12.75 7.5 L 10.875 7.5 C 10.378 7.5 9.901 7.302 9.549 6.951 C 9.198 6.599 9 6.122 9 5.625 L 9 3.75 C 9 2.755 8.605 1.802 7.902 1.098 C 7.198 0.395 6.245 0 5.25 0 L 1.875 0 Z M 3.75 13.5 C 3.75 13.301 3.829 13.11 3.97 12.97 C 4.11 12.829 4.301 12.75 4.5 12.75 L 12 12.75 C 12.199 12.75 12.39 12.829 12.53 12.97 C 12.671 13.11 12.75 13.301 12.75 13.5 C 12.75 13.699 12.671 13.89 12.53 14.03 C 12.39 14.171 12.199 14.25 12 14.25 L 4.5 14.25 C 4.301 14.25 4.11 14.171 3.97 14.03 C 3.829 13.89 3.75 13.699 3.75 13.5 Z M 4.5 15.75 C 4.301 15.75 4.11 15.829 3.97 15.97 C 3.829 16.11 3.75 16.301 3.75 16.5 C 3.75 16.699 3.829 16.89 3.97 17.03 C 4.11 17.171 4.301 17.25 4.5 17.25 L 8.25 17.25 C 8.449 17.25 8.64 17.171 8.78 17.03 C 8.921 16.89 9 16.699 9 16.5 C 9 16.301 8.921 16.11 8.78 15.97 C 8.64 15.829 8.449 15.75 8.25 15.75 L 4.5 15.75 Z",
    fill: "currentColor",
    fillRule: "evenodd"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 6.963,
    height: 6.963,
    viewBox: "0 0 6.963 6.963",
    fill: "none",
    style: {
      position: "absolute",
      left: 12.971,
      top: 1.816,
      width: 6.963,
      height: 6.963,
      color: "var(--sub)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 0 C 0.827 0.953 1.281 2.173 1.279 3.434 L 1.279 5.309 C 1.279 5.516 1.447 5.684 1.654 5.684 L 3.529 5.684 C 4.79 5.682 6.01 6.136 6.963 6.963 C 6.523 5.29 5.647 3.763 4.423 2.54 C 3.2 1.316 1.673 0.44 0 0 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--sub)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text2 ?? "기록")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      overflow: "hidden",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 18.312,
    height: 19.500,
    viewBox: "0 0 18.312 19.500",
    fill: "none",
    style: {
      position: "absolute",
      left: 2.845,
      top: 2.25,
      width: 18.312,
      height: 19.5,
      color: "var(--text-secondary-2)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 8.233 0 C 7.316 0 6.534 0.663 6.383 1.567 L 6.205 2.639 C 6.185 2.759 6.09 2.899 5.908 2.987 C 5.566 3.152 5.236 3.342 4.922 3.557 C 4.756 3.672 4.588 3.683 4.472 3.64 L 3.455 3.258 C 3.039 3.102 2.582 3.099 2.164 3.249 C 1.746 3.399 1.395 3.692 1.173 4.077 L 0.251 5.674 C 0.029 6.058 -0.049 6.509 0.03 6.946 C 0.109 7.382 0.341 7.777 0.683 8.059 L 1.523 8.751 C 1.618 8.829 1.693 8.98 1.677 9.181 C 1.649 9.56 1.649 9.941 1.677 10.32 C 1.692 10.52 1.618 10.672 1.524 10.75 L 0.683 11.442 C 0.341 11.724 0.109 12.119 0.03 12.555 C -0.049 12.992 0.029 13.443 0.251 13.827 L 1.173 15.424 C 1.395 15.808 1.746 16.102 2.164 16.251 C 2.582 16.401 3.04 16.398 3.455 16.242 L 4.474 15.86 C 4.589 15.817 4.757 15.829 4.924 15.942 C 5.236 16.156 5.565 16.347 5.909 16.512 C 6.091 16.6 6.186 16.74 6.206 16.862 L 6.384 17.933 C 6.535 18.837 7.317 19.5 8.234 19.5 L 10.078 19.5 C 10.994 19.5 11.777 18.837 11.928 17.933 L 12.106 16.861 C 12.126 16.741 12.22 16.601 12.403 16.512 C 12.747 16.347 13.076 16.156 13.388 15.942 C 13.555 15.828 13.723 15.817 13.838 15.86 L 14.858 16.242 C 15.274 16.397 15.731 16.4 16.148 16.25 C 16.566 16.1 16.916 15.807 17.138 15.423 L 18.061 13.826 C 18.283 13.442 18.361 12.991 18.282 12.554 C 18.203 12.118 17.972 11.723 17.629 11.441 L 16.789 10.749 C 16.694 10.671 16.619 10.52 16.635 10.319 C 16.664 9.94 16.664 9.559 16.635 9.18 C 16.619 8.98 16.694 8.828 16.788 8.75 L 17.628 8.058 C 18.336 7.476 18.519 6.468 18.061 5.673 L 17.139 4.076 C 16.917 3.692 16.566 3.398 16.148 3.249 C 15.73 3.099 15.273 3.102 14.857 3.258 L 13.837 3.64 C 13.723 3.683 13.555 3.671 13.388 3.557 C 13.075 3.342 12.746 3.152 12.403 2.987 C 12.22 2.9 12.126 2.76 12.106 2.639 L 11.927 1.567 C 11.854 1.129 11.628 0.731 11.29 0.444 C 10.951 0.157 10.521 0 10.077 0 L 8.234 0 L 8.233 0 Z M 9.155 13.5 C 10.15 13.5 11.104 13.105 11.807 12.402 C 12.51 11.698 12.905 10.745 12.905 9.75 C 12.905 8.755 12.51 7.802 11.807 7.098 C 11.104 6.395 10.15 6 9.155 6 C 8.161 6 7.207 6.395 6.504 7.098 C 5.8 7.802 5.405 8.755 5.405 9.75 C 5.405 10.745 5.8 11.698 6.504 12.402 C 7.207 13.105 8.161 13.5 9.155 13.5 Z",
    fill: "currentColor",
    fillRule: "evenodd"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--gray-700)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text3 ?? "설정")));
  const __body2 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 393,
      borderRadius: "16px 16px 0px 0px",
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "0px -2px 4px 0px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "row",
      padding: "16px 60px 28px 60px",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      flexShrink: 0,
      color: "var(--text-secondary-2)"
    }
  }, props.icon1 ?? /*#__PURE__*/React.createElement(IconHomeMonoHomeFamily, {
    style: {
      transform: "scale(0.750, 0.750)",
      transformOrigin: "0 0"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--gray-700)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "홈")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      overflow: "hidden",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16.500,
    height: 21,
    viewBox: "0 0 16.500 21",
    fill: "none",
    style: {
      position: "absolute",
      left: 3.75,
      top: 1.5,
      width: 16.5,
      height: 21,
      color: "var(--text-secondary-2)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 1.875 0 C 0.839 0 0 0.84 0 1.875 L 0 19.125 C 0 20.16 0.84 21 1.875 21 L 14.625 21 C 15.66 21 16.5 20.16 16.5 19.125 L 16.5 11.25 C 16.5 10.255 16.105 9.302 15.402 8.598 C 14.698 7.895 13.745 7.5 12.75 7.5 L 10.875 7.5 C 10.378 7.5 9.901 7.302 9.549 6.951 C 9.198 6.599 9 6.122 9 5.625 L 9 3.75 C 9 2.755 8.605 1.802 7.902 1.098 C 7.198 0.395 6.245 0 5.25 0 L 1.875 0 Z M 3.75 13.5 C 3.75 13.301 3.829 13.11 3.97 12.97 C 4.11 12.829 4.301 12.75 4.5 12.75 L 12 12.75 C 12.199 12.75 12.39 12.829 12.53 12.97 C 12.671 13.11 12.75 13.301 12.75 13.5 C 12.75 13.699 12.671 13.89 12.53 14.03 C 12.39 14.171 12.199 14.25 12 14.25 L 4.5 14.25 C 4.301 14.25 4.11 14.171 3.97 14.03 C 3.829 13.89 3.75 13.699 3.75 13.5 Z M 4.5 15.75 C 4.301 15.75 4.11 15.829 3.97 15.97 C 3.829 16.11 3.75 16.301 3.75 16.5 C 3.75 16.699 3.829 16.89 3.97 17.03 C 4.11 17.171 4.301 17.25 4.5 17.25 L 8.25 17.25 C 8.449 17.25 8.64 17.171 8.78 17.03 C 8.921 16.89 9 16.699 9 16.5 C 9 16.301 8.921 16.11 8.78 15.97 C 8.64 15.829 8.449 15.75 8.25 15.75 L 4.5 15.75 Z",
    fill: "currentColor",
    fillRule: "evenodd"
  })), /*#__PURE__*/React.createElement("svg", {
    width: 6.963,
    height: 6.963,
    viewBox: "0 0 6.963 6.963",
    fill: "none",
    style: {
      position: "absolute",
      left: 12.971,
      top: 1.816,
      width: 6.963,
      height: 6.963,
      color: "var(--text-secondary-2)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 0 C 0.827 0.953 1.281 2.173 1.279 3.434 L 1.279 5.309 C 1.279 5.516 1.447 5.684 1.654 5.684 L 3.529 5.684 C 4.79 5.682 6.01 6.136 6.963 6.963 C 6.523 5.29 5.647 3.763 4.423 2.54 C 3.2 1.316 1.673 0.44 0 0 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--gray-700)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text2 ?? "기록")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24,
      overflow: "hidden",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 18.312,
    height: 19.500,
    viewBox: "0 0 18.312 19.500",
    fill: "none",
    style: {
      position: "absolute",
      left: 2.845,
      top: 2.25,
      width: 18.312,
      height: 19.5,
      color: "var(--sub)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 8.233 0 C 7.316 0 6.534 0.663 6.383 1.567 L 6.205 2.639 C 6.185 2.759 6.09 2.899 5.908 2.987 C 5.566 3.152 5.236 3.342 4.922 3.557 C 4.756 3.672 4.588 3.683 4.472 3.64 L 3.455 3.258 C 3.039 3.102 2.582 3.099 2.164 3.249 C 1.746 3.399 1.395 3.692 1.173 4.077 L 0.251 5.674 C 0.029 6.058 -0.049 6.509 0.03 6.946 C 0.109 7.382 0.341 7.777 0.683 8.059 L 1.523 8.751 C 1.618 8.829 1.693 8.98 1.677 9.181 C 1.649 9.56 1.649 9.941 1.677 10.32 C 1.692 10.52 1.618 10.672 1.524 10.75 L 0.683 11.442 C 0.341 11.724 0.109 12.119 0.03 12.555 C -0.049 12.992 0.029 13.443 0.251 13.827 L 1.173 15.424 C 1.395 15.808 1.746 16.102 2.164 16.251 C 2.582 16.401 3.04 16.398 3.455 16.242 L 4.474 15.86 C 4.589 15.817 4.757 15.829 4.924 15.942 C 5.236 16.156 5.565 16.347 5.909 16.512 C 6.091 16.6 6.186 16.74 6.206 16.862 L 6.384 17.933 C 6.535 18.837 7.317 19.5 8.234 19.5 L 10.078 19.5 C 10.994 19.5 11.777 18.837 11.928 17.933 L 12.106 16.861 C 12.126 16.741 12.22 16.601 12.403 16.512 C 12.747 16.347 13.076 16.156 13.388 15.942 C 13.555 15.828 13.723 15.817 13.838 15.86 L 14.858 16.242 C 15.274 16.397 15.731 16.4 16.148 16.25 C 16.566 16.1 16.916 15.807 17.138 15.423 L 18.061 13.826 C 18.283 13.442 18.361 12.991 18.282 12.554 C 18.203 12.118 17.972 11.723 17.629 11.441 L 16.789 10.749 C 16.694 10.671 16.619 10.52 16.635 10.319 C 16.664 9.94 16.664 9.559 16.635 9.18 C 16.619 8.98 16.694 8.828 16.788 8.75 L 17.628 8.058 C 18.336 7.476 18.519 6.468 18.061 5.673 L 17.139 4.076 C 16.917 3.692 16.566 3.398 16.148 3.249 C 15.73 3.099 15.273 3.102 14.857 3.258 L 13.837 3.64 C 13.723 3.683 13.555 3.671 13.388 3.557 C 13.075 3.342 12.746 3.152 12.403 2.987 C 12.22 2.9 12.126 2.76 12.106 2.639 L 11.927 1.567 C 11.854 1.129 11.628 0.731 11.29 0.444 C 10.951 0.157 10.521 0 10.077 0 L 8.234 0 L 8.233 0 Z M 9.155 13.5 C 10.15 13.5 11.104 13.105 11.807 12.402 C 12.51 11.698 12.905 10.745 12.905 9.75 C 12.905 8.755 12.51 7.802 11.807 7.098 C 11.104 6.395 10.15 6 9.155 6 C 8.161 6 7.207 6.395 6.504 7.098 C 5.8 7.802 5.405 8.755 5.405 9.75 C 5.405 10.745 5.8 11.698 6.504 12.402 C 7.207 13.105 8.161 13.5 9.155 13.5 Z",
    fill: "currentColor",
    fillRule: "evenodd"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 10,
      textAlign: "center",
      lineHeight: "100%",
      color: "var(--sub)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text3 ?? "설정")));
  const __impls = {
    // figma: 속성 1=홈
    "prop=홈": __body0,
    // figma: 속성 1=기록
    "prop=기록": __body1,
    // figma: 속성 1=설정
    "prop=설정": __body2
  };
  return (__impls[__vkey_NavigationBar(props)] ?? __body0)();
}

// figma node: 47:2117 Component 1 (3 variants)
const __venc_Component1 = v => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey_Component1 = p => "prop=" + __venc_Component1(p.prop);
function Component1(_p = {}) {
  const props = {
    ..._p,
    prop: _p.prop ?? "전체"
  };
  const __body0 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 367,
      display: "flex",
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "var(--sub)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "rgb(255,255,255)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text1 ?? "전체 (5)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "inset 0 0 0 1px var(--border-strong-2)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-secondary-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text2 ?? "AI 텍스트 (3)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "inset 0 0 0 1px var(--border-strong-2)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-secondary-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text3 ?? "사진 근거 (2)")));
  const __body1 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 367,
      display: "flex",
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "inset 0 0 0 1px var(--border-strong-2)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-secondary-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text1 ?? "전체 (5)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "var(--sub)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "rgb(255,255,255)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text2 ?? "AI 텍스트 (3)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "inset 0 0 0 1px var(--border-strong-2)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-secondary-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text3 ?? "사진 근거 (2)")));
  const __body2 = () => /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 367,
      display: "flex",
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "inset 0 0 0 1px var(--border-strong-2)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-secondary-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text1 ?? "전체 (5)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "rgb(255,255,255)",
      boxShadow: "inset 0 0 0 1px var(--border-strong-2)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "var(--text-secondary-2)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text2 ?? "AI 텍스트 (3)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 8,
      backgroundColor: "var(--sub)",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      padding: "10px 20px 10px 20px",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 500,
      fontSize: 16,
      whiteSpace: "nowrap",
      lineHeight: 1.399999976158142,
      letterSpacing: "-0.010em",
      color: "rgb(255,255,255)",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, props.text3 ?? "사진 근거 (2)")));
  const __impls = {
    // figma: 속성 1=전체
    "prop=전체": __body0,
    // figma: 속성 1=AI
    "prop=ai": __body1,
    // figma: 속성 1=사진
    "prop=사진": __body2
  };
  return (__impls[__vkey_Component1(props)] ?? __body0)();
}

// figma node: 44:909 top navagation bar
function TopNavagationBar(_p = {}) {
  const props = _p;
  return /*#__PURE__*/React.createElement("div", {
    className: props.className,
    style: {
      width: 1440,
      backgroundColor: "var(--bg)",
      display: "flex",
      flexDirection: "row",
      padding: "30px 40px 30px 40px",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "row",
      gap: 55,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      flexShrink: 0,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 46.148,
    viewBox: "0 0 46.148 42.031",
    fill: "none",
    style: {
      position: "relative",
      width: 46.148,
      flexShrink: 0,
      alignSelf: "stretch",
      color: "rgb(20,35,61)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 32.843 13.474 L 36.738 7.71 C 30.648 7.716 18.186 7.743 17.058 7.801 C 15.93 7.858 14.25 8.62 13.551 8.994 C 12.382 9.765 9.971 12.07 9.682 15.121 C 9.507 16.969 10.368 18.447 11.364 19.467 C 12.45 20.579 13.977 21.082 15.462 21.54 L 28.605 25.589 C 29.287 25.733 30.587 26.29 30.326 27.36 C 30.066 28.43 29.07 28.746 28.605 28.769 L 15.424 28.769 C 14.335 28.769 13.508 29.379 13.231 29.684 L 9.056 34.511 L 27.131 34.511 C 29.697 34.511 32.383 34.328 34.415 32.761 C 36.404 31.228 38.261 28.687 38.261 24.864 C 38.261 18.69 33.417 16.836 30.996 16.681 L 17.444 16.681 C 16.966 16.605 16.01 16.188 16.01 15.121 C 16.01 14.053 16.966 13.578 17.444 13.474 L 32.843 13.474 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 18.576 25.189 L 9.649 28.721 L 9.649 21.657 L 18.576 25.189 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 12.501 0 C 13.327 0 13.996 0.67 13.996 1.496 L 13.996 1.769 C 13.996 2.595 13.327 3.265 12.501 3.265 L 4.761 3.265 C 3.935 3.265 3.265 3.935 3.265 4.76 L 3.265 11.995 C 3.265 12.821 2.596 13.49 1.77 13.49 L 1.496 13.49 C 0.67 13.49 0 12.821 0 11.995 L 0 1.496 C 0 0.67 0.67 0 1.496 0 L 12.501 0 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 12.501 42.031 C 13.327 42.031 13.996 41.362 13.996 40.536 L 13.996 40.262 C 13.996 39.436 13.327 38.766 12.501 38.766 L 4.761 38.766 C 3.935 38.766 3.265 38.097 3.265 37.271 L 3.265 30.036 C 3.265 29.21 2.596 28.541 1.77 28.541 L 1.496 28.541 C 0.67 28.541 0 29.21 0 30.036 L 0 40.536 C 0 41.362 0.67 42.031 1.496 42.031 L 12.501 42.031 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 33.647 0 C 32.821 0 32.152 0.67 32.152 1.496 L 32.152 1.769 C 32.152 2.595 32.821 3.265 33.647 3.265 L 41.387 3.265 C 42.213 3.265 42.883 3.935 42.883 4.76 L 42.883 11.995 C 42.883 12.821 43.552 13.49 44.378 13.49 L 44.653 13.49 C 45.478 13.49 46.148 12.821 46.148 11.995 L 46.148 1.496 C 46.148 0.67 45.478 0 44.653 0 L 33.647 0 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M 33.647 42.031 C 32.821 42.031 32.152 41.362 32.152 40.536 L 32.152 40.262 C 32.152 39.436 32.821 38.766 33.647 38.766 L 41.387 38.766 C 42.213 38.766 42.883 38.097 42.883 37.271 L 42.883 30.036 C 42.883 29.21 43.552 28.541 44.378 28.541 L 44.653 28.541 C 45.478 28.541 46.148 29.21 46.148 30.036 L 46.148 40.536 C 46.148 41.362 45.478 42.031 44.653 42.031 L 33.647 42.031 Z",
    fill: "currentColor",
    fillRule: "nonzero"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Prompt, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 700,
      fontSize: 28.71369171142578,
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "rgb(20,35,61)",
      flexShrink: 0,
      alignSelf: "stretch",
      whiteSpace: "nowrap"
    }
  }, props.text1 ?? "Scene Stealer")), /*#__PURE__*/React.createElement(TopBar, {
    style: {
      position: "relative",
      flexShrink: 0
    },
    prop: "홈"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "row",
      gap: 32,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Plan, {
    style: {
      position: "relative",
      width: 80,
      height: 40,
      flexShrink: 0
    },
    prop: "pro"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      flexWrap: "nowrap",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 30,
      height: 30,
      overflow: "hidden",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 20.623,
    height: 26.250,
    viewBox: "0 0 20.623 26.250",
    fill: "none",
    style: {
      position: "absolute",
      left: 4.689,
      top: 1.875,
      width: 20.623,
      height: 26.25,
      color: "var(--text-default-2)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 4.686 5.625 C 4.686 4.133 5.279 2.702 6.334 1.648 C 7.389 0.593 8.82 0 10.311 0 C 11.803 0 13.234 0.593 14.289 1.648 C 15.344 2.702 15.936 4.133 15.936 5.625 C 15.936 7.117 15.344 8.548 14.289 9.602 C 13.234 10.657 11.803 11.25 10.311 11.25 C 8.82 11.25 7.389 10.657 6.334 9.602 C 5.279 8.548 4.686 7.117 4.686 5.625 Z M 0 23.256 C 0.042 20.549 1.147 17.968 3.076 16.068 C 5.005 14.169 7.604 13.104 10.311 13.104 C 13.019 13.104 15.617 14.169 17.546 16.068 C 19.476 17.968 20.58 20.549 20.623 23.256 C 20.626 23.438 20.576 23.618 20.479 23.772 C 20.382 23.926 20.242 24.049 20.076 24.125 C 17.013 25.53 13.682 26.255 10.311 26.25 C 6.829 26.25 3.52 25.49 0.546 24.125 C 0.381 24.049 0.241 23.926 0.144 23.772 C 0.047 23.618 -0.003 23.438 0 23.256 Z",
    fill: "currentColor",
    fillRule: "evenodd"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0
    }
  }, props.text2 ?? "홍길동님")), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      whiteSpace: "nowrap",
      lineHeight: 1.5,
      letterSpacing: "-0.010em",
      color: "var(--text-default-2)",
      flexShrink: 0
    }
  }, props.text3 ?? "로그아웃")));
}

// Globals for scripts loaded after this file.
window.Button = Button;
window.Input = Input;
window.TopBar = TopBar;
window.Plan = Plan;
window.ToggleSwitch = ToggleSwitch;
window.IconHomeMonoHomeFamily = IconHomeMonoHomeFamily;
window.NavigationBar = NavigationBar;
window.Component1 = Component1;
window.TopNavagationBar = TopNavagationBar;