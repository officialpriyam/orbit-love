import type {
  ReactNode,
  ButtonHTMLAttributes,
  ChangeEventHandler,
} from "react";
export const Button = ({
  children,
  variant = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
  <button className={"btn " + variant} {...props}>
    {children}
  </button>
);
export const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <label className="field">
    {label}
    {children}
  </label>
);
export const Select = ({
  name,
  options,
  value,
  onChange,
  required = true,
}: {
  name?: string;
  options: string[];
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  required?: boolean;
}) => (
  <select name={name} value={value} onChange={onChange} required={required}>
    <option value="">Choose one</option>
    {options.map((x) => (
      <option key={x}>{x}</option>
    ))}
  </select>
);
