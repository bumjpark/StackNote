import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    ...props
}) => {
    // Note: Using CSS classes defined in components.css

    // Note: Using inline styles for dynamic classes since we don't have tailwind fully configured with custom classes yet.
    // Actually, I defined standard CSS variables. I will use standard style object or classNames if using modules.
    // Since I am supposed to use Vanilla CSS, I should probably stick to standard classes or inline styles.
    // For now, I'll use a style object map approach essentially but via className string for simplicity if tailwind was here.
    // BUT: The user asked for Vanilla CSS "unless user requests tailwind". 
    // I initialized with `create-vite`. I did NOT install tailwind.
    // So `bg-blue-600` won't work! I need to write actual CSS or use `style` prop.

    // Correction: I must implement this using CSS Modules or Vanilla CSS classes.
    // I'll use a simple CSS file for components: `src/components/components.css`.

    return (
        <button
            className={`btn btn-${variant} btn-${size} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
