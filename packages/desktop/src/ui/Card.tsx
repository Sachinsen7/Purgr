import { Component, JSX } from "solid-js";
import { clsx } from "clsx";

interface CardProps {
  class?: string;
  children: JSX.Element;
}

export const Card: Component<CardProps> = (props) => {
  return (
    <div class={clsx("bg-white rounded-lg shadow-sm border border-gray-200", props.class)}>
      {props.children}
    </div>
  );
};

interface CardHeaderProps {
  class?: string;
  children: JSX.Element;
}

export const CardHeader: Component<CardHeaderProps> = (props) => {
  return (
    <div class={clsx("px-6 py-4 border-b border-gray-200", props.class)}>
      {props.children}
    </div>
  );
};

interface CardBodyProps {
  class?: string;
  children: JSX.Element;
}

export const CardBody: Component<CardBodyProps> = (props) => {
  return (
    <div class={clsx("px-6 py-4", props.class)}>
      {props.children}
    </div>
  );
};