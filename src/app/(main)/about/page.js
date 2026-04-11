'use client';

import Image from 'next/image';
import Link from 'next/link';

import { BlurFade } from '@/components/ui/blur-fade';
import { BorderBeam } from '@/components/ui/border-beam';
import { TextAnimate } from '@/components/ui/text-animate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GithubIcon } from '@/components/ui/github';
import { ExternalLink, Users } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="relative mx-auto max-w-3xl space-y-16 pb-20">
      <section className="relative z-10 flex flex-col items-center gap-6 pt-8 text-center">
        <BlurFade delay={0.2} inView>
          <TextAnimate
            animation="blurInUp"
            by="word"
            className="text-4xl font-bold tracking-tight sm:text-5xl"
          >
            About Radar
          </TextAnimate>
        </BlurFade>

        <BlurFade delay={0.35} inView>
          <p className="max-w-lg text-base text-muted-foreground leading-relaxed">
            A real-time alert dashboard delivering critical safety information
            across Israel built on open data, open source, and community trust.
          </p>
        </BlurFade>
      </section>

      <BlurFade delay={0.55} inView>
        <section className="relative z-10">
          <div className="relative p-8 sm:p-10 overflow-hidden rounded-2xl border border-border/40 p-0">
            <BorderBeam
              duration={8}
              size={300}
              className="from-transparent via-red-500/40 to-transparent "
            />

            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-red-500/10 blur-xl" />
                <Image
                  src="/siren.png"
                  alt="Siren"
                  width={70}
                  height={70}
                  className="relative shrink-0 drop-shadow-lg"
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Siren</h2>
                <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
                  Radar is powered by the Siren system - a private project
                  that aggregates and distributes real-time emergency alerts
                  across Israel. All alert data displayed on this dashboard
                  originates from Siren.
                </p>
              </div>

              <Button variant="outline" className="rounded-full">
                <Link
                  href="https://siren.co.il?utm_source=radar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Visit Siren
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.75} inView>
        <section className="relative z-10 space-y-6">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-muted-foreground" />
            Credits
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Oriel */}
            <div className="rounded-xl border border-border/40 p-5">
              <div className="flex items-start gap-4">
                <Image
                  src="https://avatars.githubusercontent.com/orielhaim"
                  alt="Oriel Haim"
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Link
                      href="https://github.com/orielhaim"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm hover:underline"
                    >
                      Oriel Haim
                    </Link>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 rounded-full"
                    >
                      Creator
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Creator and maintainer of the Siren system and Radar
                    dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Yuval */}
            <div className="rounded-xl border border-border/40 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-sm font-bold text-white shadow-lg">
                  Y
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">Yuval Harpaz</h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 rounded-full"
                    >
                      Analyst
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Data analyst responsible for research, data quality, and
                    analytical insights.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.9} inView>
        <div className="relative z-10 flex justify-center border-t border-border/40 pt-10">
          <Link
            href="https://github.com/orielhaim/radar"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex max-w-md flex-col items-center gap-3 text-center text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex-row sm:text-left"
          >
            <GithubIcon
              size={24}
              className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            />
            <p className="leading-relaxed">
              Radar is an open source project. Source code and contributions
              are welcome on{' '}
              <span className="font-medium text-foreground underline-offset-4 group-hover:underline">
                GitHub
              </span>
              .
            </p>
          </Link>
        </div>
      </BlurFade>
    </div>
  );
}
