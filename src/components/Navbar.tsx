"use client";
import Link from "next/link";
import Image from "next/image";
import { Button } from "./ui/button";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { FaTwitter, FaLinkedin, FaInstagram } from "react-icons/fa";

const Navbar = () => {
  const pathname = usePathname();
  const [activeLink, setActiveLink] = useState(pathname);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Social media icons - filtered to only Twitter, LinkedIn, and Instagram
  const FILTERED_SOCIAL_ICONS = [
    { Icon: FaTwitter, href: "https://twitter.com/BrokingSapphire" },
    { Icon: FaLinkedin, href: "https://linkedin.com/company/BrokingSapphire" },
    { Icon: FaInstagram, href: "https://instagram.com/BrokingSapphire" },
  ];

  useEffect(() => {
    setActiveLink(pathname);
  }, [pathname]);

  //Close sidebar when pathname changes (user navigates)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock/unlock body scroll when sidebar is open/closed
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isSidebarOpen]);

  const navLinks = [
    { href: "https://www.sapphirebroking.com/about", label: "About" },
    { href: "https://www.sapphirebroking.com/product", label: "Product" },
    { href: "https://www.sapphirebroking.com/pricing", label: "Pricing" },
    { href: "https://www.sapphirebroking.com/contact", label: "Contact" },
  ];

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    <>
      <nav className="fixed font-poppins w-full top-0 z-50 bg-white backdrop-blur-md shadow-sm">
        <div className="xl:max-w-7xl mx-auto flex items-center justify-between py-4 pl-4 px-6 lg:px-20">
          <Link href="https://www.sapphirebroking.com">
            <div className="items-center flex">
              <Image
                src="/logo.svg"
                alt="Sapphire Logo"
                width={100}
                height={100}
                className="w-10 h-10"
              />
              <p className="font-semibold text-2xl text-black">Sapphire</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex flex-1 justify-center">
            <div className="flex uppercase items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative group text-black py-2 transition-all duration-300"
                  onClick={() => setActiveLink(link.href)}
                >
                  {link.label}

                  {/* Green underline animation with consistent 140% length for both hover & active states */}
                  <span
                    className={`absolute -bottom-4 left-1/2 transform -translate-x-1/2 h-[3px] bg-[#064D51] transition-all duration-300 ${
                      activeLink === link.href ? "w-[140%]" : "w-0"
                    } group-hover:w-[140%]`}
                  ></span>
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden lg:flex space-x-4">
            <Link href="https://terminal.sapphirebroking.com" target="_blank" rel="noopener noreferrer">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="https://signup.sapphirebroking.com">
              <Button variant="ghost">Signup</Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden flex flex-col space-y-1.5 cursor-pointer z-50"
            onClick={toggleSidebar}
            aria-label="Toggle mobile menu"
          >
            <span
              className={`block h-0.5 w-6 bg-black transition-transform duration-300 ease-in-out ${
                isSidebarOpen ? "rotate-45 translate-y-2" : ""
              }`}
            ></span>
            <span
              className={`block h-0.5 w-6 bg-black transition-opacity duration-300 ease-in-out ${
                isSidebarOpen ? "opacity-0" : "opacity-100"
              }`}
            ></span>
            <span
              className={`block h-0.5 w-6 bg-black transition-transform duration-300 ease-in-out ${
                isSidebarOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            ></span>
          </button>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggleSidebar}
      ></div>

      <aside
        className={`fixed top-0 right-0 h-full w-full  bg-gradient-to-br from-white to-gray-50 z-50 shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full pt-20 pb-6 px-6">
          <div className="absolute  backdrop-blur-md shadow-sm pb-3 top-5 right-6 flex items-center justify-between w-full">
            <div className="ml-10 items-center flex">
              <Image
                src="/logo.svg"
                alt="Sapphire Logo"
                width={100}
                height={100}
                className="w-10 h-10"
              />
              <p className="font-semibold text-2xl text-black">Sapphire</p>
            </div>
            <button
              onClick={toggleSidebar}
              className=" rounded-full hover:bg-gray-100 transition-colors duration-200"
              aria-label="Close sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col space-y-6 mt-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-lg font-medium py-2 border-l-4 pl-4 transition-colors duration-200 ${
                  activeLink === link.href
                    ? "border-[#064D51] text-[#064D51]"
                    : "border-transparent hover:border-gray-300 hover:text-gray-700"
                }`}
                onClick={() => {
                  setActiveLink(link.href);
                  setSidebarOpen(false);
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Section */}
          <div className="mt-auto space-y-4 border-t border-gray-200 pt-6">
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                Login
              </Button>
            </Link>
            <Link href="https://signup.sapphirebroking.com" className="block">
              <Button className="w-full bg-[#064D51] hover:bg-[#043638] text-white">
                Signup
              </Button>
            </Link>
          </div>

          {/* Social Links */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {FILTERED_SOCIAL_ICONS.map(({ Icon, href }, index) => (
              <a
                key={index}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-[#064D51] transition-colors duration-300"
                aria-label={`Visit our ${Icon.name.replace("Fa", "")}`}
              >
                <Icon className="w-6 h-6" />
              </a>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Navbar;