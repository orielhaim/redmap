"use client";;
import * as React from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import useMeasure from "react-use-measure";

import { cn } from "@/lib/utils";

function OdometerDigit({
  springValue,
  place
}) {
  const [ref, { height }] = useMeasure();

  const y = useTransform(springValue, (v) => {
    if (!height) return 0;
    const digit = (Math.abs(v) / place) % 10;
    return -digit * height;
  });

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: "1ch",
        overflowY: "clip",
        overflowX: "visible",
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}>
      <span ref={ref} style={{ visibility: "hidden", display: "block" }}>
        0
      </span>
      <motion.span
        style={{
          y,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
        }}>
        {/* 11 digits (0–9 + repeated 0) so the 9→0 wrap is seamless */}
        {Array.from({ length: 11 }, (_, i) => (
          <span
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: height || "1em",
            }}>
            {i % 10}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

const CHAR_VARIANTS = {
  fade: {
    initial: { opacity: 0, scale: 0.7 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.7 },
    transition: { duration: 0.14, ease: "easeOut" },
    overflow: "hidden",
  },
  blur: {
    initial: (up) => ({
      opacity: 0,
      filter: "blur(8px)",
      y: up ? -8 : 8,
    }),
    animate: { opacity: 1, filter: "blur(0px)", y: 0 },
    exit: (up) => ({
      opacity: 0,
      filter: "blur(8px)",
      y: up ? 8 : -8,
    }),
    transition: { duration: 0.18, ease: "easeOut" },
    overflow: "visible",
  },
};

function CharSlot({
  char,
  charKey,
  effect,
  countingUp
}) {
  const isDigit = /\d/.test(char);

  if (!isDigit) {
    return <span style={{ display: "inline-block" }}>{char}</span>;
  }

  const v = CHAR_VARIANTS[effect];
  const initial =
    typeof v.initial === "function" ? v.initial(countingUp) : v.initial;
  const exit =
    "exit" in v && typeof v.exit === "function"
      ? v.exit(countingUp)
      : (v.exit);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        overflow: v.overflow,
      }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={charKey}
          initial={initial}
          animate={v.animate}
          transition={v.transition}
          style={{ display: "inline-block" }}>
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 2,
  digitEffect = "none",
  className,
  startWhen = true,
  separator = "",
  onStart,
  onEnd
}) {
  const ref = React.useRef(null);
  const motionValue = useMotionValue(direction === "down" ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const getDecimalPlaces = num => {
    const str = num.toString();
    if (str.includes(".")) {
      const parts = str.split(".");
      const decimals = parts[1];
      if (decimals && parseInt(decimals) !== 0) return decimals.length;
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = React.useCallback((latest) => {
    const hasDecimals = maxDecimals > 0;
    const options = {
      useGrouping: !!separator,
      minimumFractionDigits: hasDecimals ? maxDecimals : 0,
      maximumFractionDigits: hasDecimals ? maxDecimals : 0,
    };
    const formatted = Intl.NumberFormat("en-US", options).format(latest);
    return separator ? formatted.replace(/,/g, separator) : formatted;
  }, [maxDecimals, separator]);

  const initialStr = formatValue(direction === "down" ? to : from);
  const [chars, setChars] = React.useState(initialStr.split(""));

  React.useEffect(() => {
    const initial = formatValue(direction === "down" ? to : from);
    if (digitEffect === "none") {
      if (ref.current) ref.current.textContent = initial;
    } else if (digitEffect !== "slide") {
      setChars(initial.split(""));
    }
  }, [from, to, direction, formatValue, digitEffect]);

  React.useEffect(() => {
    if (isInView && startWhen) {
      onStart?.();
      const t1 = setTimeout(() => {
        motionValue.set(direction === "down" ? from : to);
      }, delay * 1000);
      const t2 = setTimeout(() => onEnd?.(), delay * 1000 + duration * 1000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [
    isInView,
    startWhen,
    motionValue,
    direction,
    from,
    to,
    delay,
    onStart,
    onEnd,
    duration,
  ]);

  React.useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (digitEffect === "none") {
        if (ref.current) ref.current.textContent = formatValue(latest);
      } else if (digitEffect !== "slide") {
        setChars(formatValue(latest).split(""));
      }
    });
    return () => unsubscribe();
  }, [springValue, formatValue, digitEffect]);

  const countingUp = direction === "up";

  if (digitEffect === "slide") {
    const targetStr = formatValue(direction === "down" ? from : to);
    const digits = [];
    const structure = [];
    let digitCount = 0;
    for (const ch of targetStr) {
      if (/\d/.test(ch)) digitCount++;
    }
    let d = 0;
    for (const ch of targetStr) {
      if (/\d/.test(ch)) {
        const placeFromRight = digitCount - 1 - d;
        structure.push({ type: "digit", placeIdx: placeFromRight });
        d++;
      } else {
        structure.push({ type: "sep", char: ch });
      }
    }

    return (
      <span
        ref={ref}
        className={cn("inline-flex items-center", className)}
        style={{ fontVariantNumeric: "tabular-nums" }}>
        {structure.map((item, i) =>
          item.type === "sep" ? (
            <span key={i}>{item.char}</span>
          ) : (
            <OdometerDigit key={i} springValue={springValue} place={Math.pow(10, item.placeIdx)} />
          ))}
      </span>
    );
  }

  if (digitEffect === "none") {
    return <span ref={ref} className={cn(className)} />;
  }

  return (
    <span ref={ref} className={cn("inline-flex items-center", className)}>
      {chars.map((char, i) => (
        <CharSlot
          key={i}
          char={char}
          charKey={`${i}-${char}`}
          effect={digitEffect}
          countingUp={countingUp} />
      ))}
    </span>
  );
}

export { CountUp };
