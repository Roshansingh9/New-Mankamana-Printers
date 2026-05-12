"use client";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now just log – integrate API/WhatsApp later
    console.log("Contact form submitted", form);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar/>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Header */}
        <div className="mb-10 text-center lg:text-left flex flex-col items-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Get in touch with New Mankamana Printers
          </h1>
          <div className="divider mt-1 h-[4px] rounded-full w-52 bg-blue-500 my-4" />
          <p className="mt-3 text-center text-sm sm:text-base text-slate-500 max-w-2xl mx-auto lg:mx-0">
            Have a question about orders, corporate printing, or free design
            templates? Send us a message and our team will get back to you as
            soon as possible.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1.1fr] gap-8 items-start">
          {/* Left: Contact details + form */}
          <div className="space-y-6">
            {/* Contact cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h2 className="text-xs font-bold tracking-[0.16em] uppercase text-slate-500 mb-3">
                  Our Location
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed">
                  Head Office
                  <br />
                  Traffic Chowk, (Jagriti Path)
                  <br />
                  Butwal, Rupandehi, Nepal
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h2 className="text-xs font-bold tracking-[0.16em] uppercase text-slate-500 mb-3">
                  Contact Details
                </h2>
                <div className="flex flex-col gap-1 text-sm text-slate-700 leading-relaxed">
                  <div>
                    <span className="text-[color:var(--primary)] mr-2">📞</span>
                    <span>
                      <a href="tel:+9779804458995" className="text-blue-600 font-semibold">
                        +977 9804458995
                      </a>{" "}
                      <span className="text-slate-400">(Office)</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[color:var(--primary)] mr-2">📞</span>
                    <span>
                      <a href="tel:+9779705396330" className="text-blue-600 font-semibold">
                        +977 9705396330
                      </a>{" "}
                      <span className="text-slate-400">(Office)</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[color:var(--primary)] mr-2">📞</span>
                    <span>
                      <a href="tel:+9779847526152" className="text-blue-600 font-semibold">
                        +977 9847526152
                      </a>
                    </span>
                  </div>
                  <div>
                    <span className="text-green-500 mr-2">💬</span>
                    <span>
                      <a
                        href="https://wa.me/9779806955313"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 font-semibold"
                      >
                        +977 9806955313
                      </a>{" "}
                      <span className="text-slate-400">(WhatsApp)</span>
                    </span>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className="text-[color:var(--primary)] mr-2">✉️</span>
                    <a href="mailto:nmpress2082@gmail.com" className="text-blue-600 font-semibold">
                      nmpress2082@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7">
              <h2 className="text-sm font-extrabold text-slate-900 mb-4">
                Send us a message
              </h2>
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-slate-500">
                    Your Name
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Full name"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-slate-500">
                    Company
                  </label>
                  <input
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="Company / Organization"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-slate-500">
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-slate-500">
                    Phone
                  </label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+977 98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-slate-500">
                    How can we help?
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Tell us a bit about your printing requirements…"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15 resize-y"
                    required
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end pt-1">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-md border-0 cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    Send Message
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Map embed + timing info */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="aspect-[4/3] w-full">
                
                <iframe 
                title="New Mankamana Printers Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3925.1863626480344!2d83.46059080681277!3d27.703327986574763!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3996873276c92d51%3A0xd3c6675133d70696!2sTraffic%20chowk!5e0!3m2!1sen!2sus!4v1772899341438!5m2!1sen!2sus" 
                className="w-full h-full border-0" 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"/>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-xs font-bold tracking-[0.16em] uppercase text-slate-500 mb-3">
                Business Hours
              </h2>
              <ul className="space-y-1 text-sm text-slate-700">
                <li className="flex justify-between">
                  <span>Sunday – Friday</span>
                  <span className="font-semibold">10:00 AM – 6:30 PM</span>
                </li>
                <li className="flex justify-between">
                  <span>Saturday</span>
                  <span className="font-semibold text-emerald-600">Closed (On Call)</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                For urgent corporate or bulk print requirements, please contact us directly on WhatsApp or phone.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer/>
    </div> 
  );
}
