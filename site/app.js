const revealItems = Array.from(document.querySelectorAll(".reveal"));

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("on");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("on"));
}

const metrics = Array.from(document.querySelectorAll(".metric[data-count]"));

function animateMetric(node, target) {
  const start = performance.now();
  const duration = 1100;

  function frame(now) {
    const elapsed = now - start;
    const ratio = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - ratio, 3);
    node.textContent = String(Math.round(target * eased));
    if (ratio < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

if ("IntersectionObserver" in window) {
  const metricObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = Number(entry.target.getAttribute("data-count") || "0");
        animateMetric(entry.target, target);
        metricObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );
  metrics.forEach((metric) => metricObserver.observe(metric));
} else {
  metrics.forEach((metric) => {
    const target = Number(metric.getAttribute("data-count") || "0");
    metric.textContent = String(target);
  });
}
