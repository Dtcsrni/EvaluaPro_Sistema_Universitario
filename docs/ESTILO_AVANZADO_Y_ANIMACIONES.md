# Guía de Estilo Avanzado, Transparencias y Animaciones

Esta guía define el estándar técnico y estético para la implementación de interfaces avanzadas en EvaluaPro, ampliando las directrices de `docs/DESIGN.md` con un enfoque en micro-interacciones, efectos de cristal (glassmorphism), transparencias y transiciones fluidas.

## 1. Principios del Diseño Dinámico

1. **Acento sobre Decoración**: Las animaciones y transparencias deben guiar la atención del usuario hacia los cambios de estado (guardando, éxito, alerta) y no sobrecargar la vista.
2. **Consistencia en Transiciones**: Todas las transformaciones interactivas (hover, focus) deben usar un tiempo estándar de `200ms` y curvas de aceleración naturales (`cubic-bezier(0.16, 1, 0.3, 1)` o `ease-out`).
3. **Profundidad Visual (Glassmorphism)**: El uso de transparencias debe ir acompañado de desenfoque de fondo (`backdrop-filter: blur()`) y un borde delgado con color-mix para mantener legibilidad y contraste en temas claro y oscuro.

---

## 2. Definición de Clases y Tokens CSS

Las siguientes clases estándar se definen para toda la aplicación y deben aplicarse en lugar de estilos en línea.

### Transparencias y Superficies

```css
/* Tarjeta de Cristal Moderno */
.glass-card {
  background: var(--surface-0);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--surface-border-strong);
  box-shadow: var(--shadow-soft);
  transition: background 250ms ease, border-color 250ms ease, box-shadow 250ms ease;
}

/* Efecto Hover sobre Cristal */
.glass-card-interactive:hover {
  background: var(--surface-1);
  border-color: color-mix(in srgb, var(--surface-border-strong) 60%, var(--app-accent, var(--primario)) 40%);
  box-shadow: var(--shadow-panel);
}
```

### Animaciones de Entrada y Transición

```css
/* Desvanecimiento Simple */
.anim-fade-in {
  animation: fadeIn 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Desplazamiento Hacia Arriba con Desvanecimiento */
.anim-slide-up {
  animation: slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Escalado Suave en Hover */
.scale-hover {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.scale-hover:hover {
  transform: translateY(-2px) scale(1.01);
}

/* Pulsación de Atención */
.pulse-glow {
  animation: pulseGlow 1.5s infinite alternate ease-in-out;
}
```

### Keyframes Estándar

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulseGlow {
  from {
    box-shadow: 0 0 0 0px color-mix(in srgb, var(--app-accent, var(--primario)) 25%, transparent);
  }
  to {
    box-shadow: 0 0 12px 4px color-mix(in srgb, var(--app-accent, var(--primario)) 8%, transparent);
  }
}

@keyframes popBadge {
  0% {
    transform: scale(0.85);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
```

---

## 3. Guía de Aplicación (Checklist)

- [ ] **Accesibilidad**: Todo elemento interactivo animado debe responder a eventos del teclado (`onKeyDown` con Enter o Espacio) y mantener un contraste mínimo de `4.5:1` en texto.
- [ ] **Reducción de Movimiento**: Respetar la directiva del sistema `@media (prefers-reduced-motion: reduce)` desactivando animaciones de desplazamiento pesado o parpadeos.
- [ ] **No Inline Styles**: Evitar absolutamente la sintaxis `style={{ ... }}` en pantallas Docente y Alumno para cumplir con los gates de calidad y el validador del pipeline.
