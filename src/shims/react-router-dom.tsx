/**
 * Shim that maps the react-router-dom v6 surface used by the original MYT
 * codebase onto TanStack Router. Lets us keep the MYT pages/components
 * unmodified while running inside TanStack Start.
 */
import * as React from "react";
import {
  Link as TSLink,
  useNavigate as useTSNavigate,
  useParams as useTSParams,
  useLocation as useTSLocation,
  type LinkProps as TSLinkProps,
} from "@tanstack/react-router";

export type LinkProps = Omit<TSLinkProps, "to"> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    replace?: boolean;
    state?: unknown;
  };

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace: _replace, state: _state, children, ...rest }, ref) => {
    // TanStack Link is type-strict; cast to any to allow dynamic string paths
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <TSLink ref={ref as any} to={to as any} {...(rest as any)}>
        {children}
      </TSLink>
    );
  },
);
Link.displayName = "Link";

export interface NavLinkProps extends Omit<LinkProps, "className" | "style" | "children"> {
  end?: boolean;
  className?:
    | string
    | ((props: { isActive: boolean; isPending: boolean }) => string);
  style?:
    | React.CSSProperties
    | ((props: { isActive: boolean; isPending: boolean }) => React.CSSProperties);
  children?:
    | React.ReactNode
    | ((props: { isActive: boolean; isPending: boolean }) => React.ReactNode);
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, end, className, style, children, ...rest }, ref) => {
    const location = useTSLocation();
    const isActive = end
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(to + "/");
    const ctx = { isActive, isPending: false };
    const resolvedClassName =
      typeof className === "function" ? className(ctx) : className;
    const resolvedStyle = typeof style === "function" ? style(ctx) : style;
    const resolvedChildren =
      typeof children === "function" ? children(ctx) : children;
    return (
      <Link
        ref={ref}
        to={to}
        className={resolvedClassName}
        style={resolvedStyle}
        {...rest}
      >
        {resolvedChildren}
      </Link>
    );
  },
);
NavLink.displayName = "NavLink";

export function useNavigate() {
  const nav = useTSNavigate();
  return React.useCallback(
    (to: string | number, opts?: { replace?: boolean; state?: unknown }) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nav({ to: to as any, replace: opts?.replace, state: opts?.state } as any);
    },
    [nav],
  );
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useTSParams({ strict: false }) as any;
}

export function useLocation() {
  const loc = useTSLocation();
  return {
    pathname: loc.pathname,
    search: loc.searchStr ?? "",
    hash: loc.hash ?? "",
    state: (loc.state ?? null) as unknown,
    key: loc.href ?? "default",
  };
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>) => void] {
  const loc = useTSLocation();
  const nav = useTSNavigate();
  const params = React.useMemo(
    () => new URLSearchParams(loc.searchStr ?? ""),
    [loc.searchStr],
  );
  const setParams = React.useCallback(
    (next: URLSearchParams | Record<string, string>) => {
      const sp = next instanceof URLSearchParams ? next : new URLSearchParams(next);
      const obj: Record<string, string> = {};
      sp.forEach((v, k) => (obj[k] = v));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nav({ search: obj as any } as any);
    },
    [nav],
  );
  return [params, setParams];
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const nav = useNavigate();
  React.useEffect(() => {
    nav(to, { replace });
  }, [nav, to, replace]);
  return null;
}

// Stubs so files that import these don't break - they're never mounted.
export const Routes: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
export const Route: React.FC<{ children?: React.ReactNode }> = () => null;
export const BrowserRouter: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
export const Outlet: React.FC = () => null;
