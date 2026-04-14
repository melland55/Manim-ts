/**
 * OpenGL compatibility layer for manim-ts.
 * TypeScript port of manim/mobject/opengl/opengl_compatibility.py
 *
 * Python uses a `ConvertToOpenGL` metaclass that auto-discovers OpenGL
 * equivalents at class-creation time. Since TypeScript has no metaclasses,
 * we use a Map-based registry instead.
 */

const openglClassMap = new Map<Function, Function>();

/**
 * Register an OpenGL equivalent for a standard Mobject class.
 *
 * @param standard - The standard (Cairo) class, e.g. VMobject
 * @param opengl   - The OpenGL equivalent class, e.g. OpenGLVMobject
 */
export function registerOpenGLEquivalent(standard: Function, opengl: Function): void {
  openglClassMap.set(standard, opengl);
}

/**
 * Return the OpenGL equivalent of a class if one has been registered,
 * otherwise return the class itself unchanged.
 *
 * Mirrors Python's `ConvertToOpenGL.get_opengl_class(cls)`.
 *
 * @param cls - A Mobject constructor
 * @returns The OpenGL equivalent constructor, or `cls` if none is registered
 */
export function convertToOpenGL<T extends Function>(cls: T): T {
  return (openglClassMap.get(cls) as T) ?? cls;
}

/**
 * Remove a previously registered OpenGL equivalent.
 */
export function unregisterOpenGLEquivalent(standard: Function): void {
  openglClassMap.delete(standard);
}

/**
 * Return a read-only view of the current registry.
 * Useful for debugging and introspection.
 */
export function getOpenGLClassMap(): ReadonlyMap<Function, Function> {
  return openglClassMap;
}
