
export const AppLogo = ({ className = "h-10 w-auto" }: { className?: string }) => {
    return (
        <img
            src="/logo.png"
            alt="CMS Duta Solusi Logo"
            className={className}
        />
    );
};
