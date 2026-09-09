import React from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { BookingTrigger } from "@/components/booking/BookingTrigger";
import { getAllServicesWithTiers } from "@/lib/db";
import {
  MapPin,
  Clock,
  CheckCircle,
  Shield,
  Heart,
  CalendarCheck,
  Award,
  Sparkles,
  Phone,
  ArrowRight,
  Leaf,
  Check,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicLandingPage() {
  const services = await getAllServicesWithTiers();

  return (
    <div className={styles.mainContainer}>
      {/* Top Navbar */}
      <header className={styles.topNav}>
        <Link href="/" className={styles.brandContainer}>
          <div className={styles.logoCircle}>
            <Leaf size={22} />
          </div>
          <div className={styles.brandTextGroup}>
            <span className={styles.brandTitle}>YYC REFLEXOLOGY</span>
            <span className={styles.brandSubtitle}>Clinical & Holistic Wellness</span>
          </div>
        </Link>

        <nav className={styles.navMenu}>
          <Link href="#about" className={styles.navItem}>Home</Link>
          <Link href="#about" className={styles.navItem}>About Us</Link>
          <Link href="#services" className={styles.navItem}>Services</Link>
          <Link href="#contact" className={styles.navItem}>Contact us</Link>
          <Link href="/booking-admin" className={styles.adminNavLink} id="practitioner-portal-nav-link">
            <Shield size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
            Doctor Portal
          </Link>
          <BookingTrigger label="Book Now" id="header-book-now-btn" />
        </nav>
      </header>

      {/* Hero Banner with About Us Heading */}
      <section className={styles.heroBanner}>
        <h1 className={styles.heroHeading}>ABOUT US</h1>
        <div className={styles.breadcrumb}>HOME / ABOUT US</div>
      </section>

      {/* Relax Reconnect Restore Section */}
      <section className={styles.contentSection} id="about">
        <div>
          <h2 className={styles.sectionHeaderSmall}>
            RELAX RECONNECT <span className={styles.highlightOrange}>RESTORE</span>
          </h2>

          <p className={styles.bodyParagraph}>
            YYC Reflexology offers refined reflexology and energy healing treatments designed to promote
            relaxation, reduce stress, and support overall well-being. Led by Abdul Khaliq, a certified
            Reflexologist with NHPC Registration, each session is thoughtfully tailored to the individual
            using therapeutic techniques and a holistic approach. Our goal is to create a calm, restorative
            experience that helps you feel balanced, relaxed, and renewed.
          </p>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <div className={styles.featureIconBox}>
                <Award size={22} />
              </div>
              <div>
                <div className={styles.featureTitle}>Quality Service</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Accredited NHPC registration & clinical standards</div>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIconBox}>
                <Heart size={22} />
              </div>
              <div>
                <div className={styles.featureTitle}>Effective Treatment</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Targeted reflex points for pain relief & circulation</div>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={`${styles.featureIconBox} ${styles.featureIconOrange}`}>
                <Clock size={22} />
              </div>
              <div>
                <div className={styles.featureTitle}>Long Term Experience</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>Years of dedicated holistic practice in Calgary</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 16, alignItems: "center" }}>
            <BookingTrigger label="Book Your Appointment" id="content-book-now-btn" />
            <a href="tel:5878878719" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#475569", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
              <Phone size={16} style={{ color: "#689f38" }} />
              587 887 8719
            </a>
          </div>
        </div>

        {/* Practitioner Bio Card */}
        <div className={styles.practitionerCard}>
          <div style={{ width: 100, height: 100, borderRadius: "50%", background: "#f1f8e9", border: "3px solid #689f38", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#689f38" }}>
            <Leaf size={48} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
            Abdul Khaliq
          </h3>
          <div style={{ fontSize: 13, color: "#689f38", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Certified Reflexologist • NHPC Registered
          </div>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 20 }}>
            Specializing in therapeutic neuromuscular foot and hand reflexology, stress management, and meridian balance. Dedicated to patient comfort in North West Calgary.
          </p>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", textAlign: "left", fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={14} style={{ color: "#689f38" }} />
              <span>NHPC Recognized Practitioner</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={14} style={{ color: "#689f38" }} />
              <span>Compliant with Private Insurance Receipts</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={14} style={{ color: "#689f38" }} />
              <span>Sanitized Private Clinical Setting</span>
            </div>
          </div>
        </div>
      </section>

      {/* Earthy Dark Quote Banner matching screenshot */}
      <section className={styles.darkQuoteBanner}>
        <div className={styles.darkQuoteContainer}>
          <p className={styles.quoteMainText}>
            “Our reflexology sessions are thoughtfully tailored to your individual needs, with a focus on
            relaxation, stress reduction, and overall well-being. Each session uses a combination of
            reflexology techniques designed to promote relaxation and help you feel more balanced
            and comfortable.”
          </p>

          <div className={styles.quoteSubheading}>
            Reflexology may be especially appealing for those experiencing:
          </div>

          <ul className={styles.conditionList}>
            <li>• High levels of stress and everyday tension</li>
            <li>• Foot discomfort, including discomfort associated with plantar fasciitis</li>
            <li>• Digestive discomfort and sensitivities</li>
            <li>• General muscle and body tension</li>
            <li>• Difficulty relaxing or maintaining healthy sleep routines</li>
            <li>• Recovery and relaxation after physical activity or sports</li>
          </ul>

          <p className={styles.disclaimerText}>
            Reflexology is a complementary wellness practice and is not intended to diagnose, treat, or cure
            medical conditions. If you have a medical concern or ongoing symptoms, please consult your
            healthcare professional.
          </p>

          <div>
            <BookingTrigger label="Book Now" id="quote-book-now-btn" />
          </div>
        </div>
      </section>

      {/* Therapeutic Services Catalog */}
      <section className={styles.servicesSection} id="services">
        <div className={styles.sectionHeaderCenter}>
          <h2 className={styles.sectionTitle}>Therapeutic Offerings</h2>
          <p className={styles.sectionDesc}>
            Select your preferred treatment below to schedule in real-time. Flexible 30, 45, and 60-minute sessions available.
          </p>
        </div>

        <div className={styles.servicesGrid}>
          {services.map((service) => (
            <div key={service.id} className={styles.serviceCard}>
              <div>
                <h3 className={styles.serviceName}>{service.name}</h3>
                <p className={styles.serviceDesc}>{service.description}</p>
                
                <div style={{ marginBottom: 10, fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Available Durations:
                </div>
                <div className={styles.tierPills}>
                  {service.tiers.map((tier) => (
                    <div key={tier.id} className={styles.tierBadge}>
                      <span>{tier.durationMinutes}m • </span>
                      <strong style={{ color: "#689f38" }}>${Number(tier.price).toFixed(0)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                <BookingTrigger label="Book Now" id={`service-book-btn-${service.id}`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer matching screenshot */}
      <footer className={styles.footer} id="contact">
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerColTitle}>About</div>
            <p className={styles.footerText} style={{ marginBottom: 16 }}>
              Professional Foot Reflexology in NW Calgary. Dedicated to personalized restorative health and holistic wellness.
            </p>
            <div style={{ display: "flex", gap: 12, color: "#cbd5e1" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>NHPC Registered Practice</span>
            </div>
          </div>

          <div>
            <div className={styles.footerColTitle}>Important Links</div>
            <ul className={styles.footerLinks}>
              <li><Link href="#about" className={styles.footerLink}>› Home</Link></li>
              <li><Link href="#about" className={styles.footerLink}>› About Us</Link></li>
              <li><Link href="#services" className={styles.footerLink}>› Services</Link></li>
              <li><Link href="#contact" className={styles.footerLink}>› Contact Us</Link></li>
              <li><Link href="/booking-admin" className={styles.footerLink}>› Doctor / Admin Portal</Link></li>
            </ul>
          </div>

          <div>
            <div className={styles.footerColTitle}>Opening Hours : With Appointment</div>
            <p className={styles.footerText} style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>
              10 AM – 8 PM
            </p>
            <p className={styles.footerText}>
              Monday to Sunday<br />
              Strictly by advance online reservation.
            </p>
          </div>

          <div>
            <div className={styles.footerColTitle}>Contact Us</div>
            <p className={styles.footerText} style={{ marginBottom: 6, fontWeight: 700, color: "#ffffff" }}>
              YYC Reflexology
            </p>
            <p className={styles.footerText} style={{ marginBottom: 8 }}>
              B1, 10880 Hidden Valley DR NW<br />
              Calgary AB
            </p>
            <p className={styles.footerText} style={{ color: "#7cb342", fontWeight: 700 }}>
              Phone: 587 887 8719
            </p>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <div>
            © Copyright 2025. All rights reserved.
          </div>
          <div>
            <BookingTrigger label="Book Now" id="footer-book-now-btn" />
          </div>
        </div>
      </footer>
    </div>
  );
}
