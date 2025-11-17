# Service Titan Mielstones
Turns integration lead
Service template
Shared libraries
Metrics standardization
K8s

## Perf review 2025-3
Top Accomplishments / Contributions
Delivered multiple financing and payments fixes in the monolith, improving reliability and resolving several transaction-page bugs.
Successfully built a proof-of-concept for Agentic Assistance, integrating with Snowflake to enable data-driven sales optimization recommendations.
Collaborated closely with the TAP and AI teams to deploy and configure agents, register them in the registry, and manage Key Vault integrations.
Served as onboarding buddy for James, providing technical guidance and helping him ramp up on Financing and internal tooling.
Led backend design and architecture for the Multi-Submissions initiative, creating a scalable service structure with shared logic and robust state tracking. Although the implementation direction shifted, the backend solution could provide a strong foundation for future enhancements.
Continuous Turns support and troubleshooting
Unraveled the Gordian knot of library dependencies associated with the Mongo version in the monolith, decopled dependencies.
Areas to Improve / Growth Opportunities
Some project efforts (e.g., Multi-Submissions) were impacted by shifting priorities and initial misalignment. I can improve by aligning earlier with stakeholders to confirm direction and ensure my work remains immediately impactful.
As the Agentic platform expands, I plan to strengthen my data engineering and observability skills (Snowflake, metrics, tracing) to improve system visibility and troubleshooting efficiency.
Next Steps
One of the main goals is to learn the Payments ecosystem and become an SME
Continue deepening expertise in AI-driven automation within the payments domain.
Increase early collaboration with the product team to improve end-to-end alignment and delivery efficiency.

## Perf review  2024-2
I made a valuable contribution to the evolution of the fintech ecosystem as a whole. Some of the major contributions are 

Turns
The majority of my efforts and focus were on the new Turns Adapter implementation. 
I conducted Initial investigation, Modeling, documentation of existing flow, and implementation details. After that, I worked on understanding and clarifying requirements and worked on the Backlog of upcoming work.
I was in Touch with Turns Team:
Many rounds of API polishing,m testing of their API, and providing feedback
Investigating webhook contracts with turns and communicating back about problems
Discussing offers and promos APIs

As part of that, I came up with a generalized catalog concept and implemented that for Turns Industries.
Important note that Turns was developed by me following the new Generalized Flows approach, details in the Generalization section
I executed full-cycle development, including application design and implementation, repository and CICD setup, IaC configuration, Azure configuration, deployment, and testing. Although the majority of the code in Turns is mine, I also worked with financing squad members.
I collaborated with the team, orchestrated team effort, and provided design and suggestions for implementation for several features: Offers with Yunting, Turns Auth with Daniel, and UI with Yunting. 
I came up with a novel approach to webhook handling and it’s customization to address multi-environment and different setups. Webhooks could be flexibly toggled, and app behavior changes, so flow could still work on Environments where Turns webhooks not reachable. 
The impact is mostly expected in the next Cycle, when we start Turns rollout and new customers will bring new revenue.
https://docs.google.com/document/d/1ezr38CLwVIORaj35NGtBwIbUn9d-Ioq6Kko0WhSeH_Y/edit?tab=t.0#heading=h.i4smkc5o829n



Generalization:
I worked on a major architecture initiative to rethink financing/adapter flows, i conducted Investigation, designed, provided contracts and flows, documentation and diagrams, and ultimately implemented the Generalized Waterfall Flow in financing:
That flow is now “Financing Driven”, where financing provides contracts. To make it future proof I onboarded customizations and features resolving abilities to Generalized flows. The impact will mostly play out when we onboard the next similar financing provider.
https://docs.google.com/presentation/d/1JQHC5-8UyjWHB_13cyS2aCrS6lMvniO4yvhn_FbFxjY/edit#slide=id.p

Note: do not confuse it with General Adapter/Generalized Adapter which Joe worked on docs, that completely different, while related.

CI/CD
Finishing R&D, POC of gated tag-based deployment process, used that in Turns. Impact will be more predictable deployments, reducing bug leaking to higher environments.
https://servicetitan.atlassian.net/wiki/spaces/PD/pages/3516140140/Fintech+Financing+Service+Deployment+Pipeline


Financing Providers Mock:
Improved synchrony mock to give it state management, that unlock for other devs ability to do more complex testing
As next step i did planning and drafting architecture of shared fin-providers mock, provided guidelines for implementation, developed and improved mock as IC.

Shared Infra:
Brought my Financing Microservice Template up to date: exception shield, MSAL, PR, net8, github actions, CPM, impact: reducing dev time to initial setup, including reducing my time working on Turns. I would say that providing Client for MicroService with embedded MSAL Auth is a big benefit. 

Synchrony
I continued work with Synchrony after the previous cycle and was focused on P13N, Entra, Auth, including specification, documentation and implementation for Provider Webhook. And some minor stuff like Loan Lookup and Import. That contribute for general development of Synchrony and onboarding more customers.


P13N
Continue increase  expertise in ST P13N, particularly coming up with a new way of using Entra to implement P13n to Legacy Auth
Helped team with different p13n questions, helped different initiatives and projects with Rollout: Finacneit App identity support, Helped Tim  with Auth as well.

Extra curriculum:
Started interviewing candidates. Impact: increased ST interviewing bandwidth 


OKR
Main OKR was 
Get turns beta ready: achieved: full flow supported, could be rolled out for production use.
CI/CD - achieved my POC goal: POC and beta implementation for Turns
Improve Test Coverage: provided mock general design and most of the implementation and infrastructure

Some sidenote reflection:
I strive to demonstrate a very careful and meticulous approach to any task. Unlike many, i would always test and make sure my code is working as well as possible.
I don’t take chances, I always try to understand all consequences. Why i bringing it up? Because i feel that in the last cycle team had a lot of situations when a rush or something else prevented them from testing everything and many people pushed their code in hoping someone else would catch bugs, even customers.

Perf 2023-2
Log

Huge caching libraries
Redis in goodleap
Extract nuget versions


Service template affecting main csod template
https://servicetitan.slack.com/archives/C05GPEBBQSD/p1712355532145819?thread_ts=1701132816.444339&cid=C05GPEBBQSD



## Perf review 2023
https://docs.google.com/document/d/1WQjhGYIT2ZuhkWbNIuVIsFm1Aqj3YSNJwDwu3sguTp8/edit

+Metrics
+Dashboards talks with infra team, dsl, etc.
+Alerts

+Data dog, metrics code
+Webhooks

+Weebhooks pr
+Some metrics pr

+Singe domain routing
+Authorization in monolith and in financing

+Because of me platform update docs

Responses:

Achieve the Extraordinary:
What results did you deliver? Briefly describe your performance.
What is at least 1 action item you can implement to achieve stronger results going forward?
As we approach the end of the cycle, I wanted to take a moment to reflect on my performance and share my thoughts with you. Overall, I believe I have had a successful half-year and have made progress in several areas.
One of my strongest traits is my accuracy and attention to details. I take pride in my work and always strive to deliver high-quality results. Especially when it comes to code design and architecture. 

Let me recall some of the projects which I worked on, I put them in chronological order from oldest to newest.

Test Coverage
In a collective push to get good unit test coverage, I covered with tests a lot of old/legacy and new shared libraries code:
https://github.com/servicetitan/fintech-shared/pull/62/files (113 files changed)
https://github.com/servicetitan/fintech-shared/pull/61/files
That also required some project structure improvements and some refactoring.

Greensky Webhooks
Adding webhooks drastically reduced the workload we put on Greensky while we were checking application status. It was around dozens of thousands of extra calls every day. Also, those calls rendered our Dkron scheduler very unstable (Dkron orchestrated calls). Webhooks allowed to decommission GreenskyTransaction Importer (my older project)  https://github.com/servicetitan/greensky-transactions-importer


Infrastructure
https://servicetitan.atlassian.net/browse/FIN-8963
Helped to spin up the stage environment, fixing Kafka configuration, and brought some legacy Kafka topics to the IaC approach. Migrated services to Stage. Working on single domain routing, for that worked on HA proxy configuration and application configurations in k8s environment 
https://servicetitan.atlassian.net/browse/FIN-8998

Auth
Worked on implementing internal authorization for financing which includes coordinated changes in monolith and financing. Used my experience and knowledge to create nicely architectured solution
https://github.com/servicetitan/financing/pull/219/files
https://github.com/servicetitan/app/pull/93262/files



From most recent is publishing plans from financing to Kafka which required fixing some other issues around. But nothing very special here.


And of course hot topic from recent - Metrics. 
That includes: 
First POC to see how it works
Creations of the toolset for team usage
Researching dashboard and testing different approaches with providing feedback to infra team (grafonet, WSDL) and requested new features
Research and experiments with alerts, providing feedback, and requesting new features
Eventually creating a set of metrics, alerts, and dashboards and documenting everything.

And some regular bug fixing.

Daniel once called me the “Platform guy of the team” which I liked a lot. I enjoy tooling, app design, architecture, and working on generic approaches to problems. That is why I worked on Fintech. Shared (https://github.com/servicetitan/fintech-shared) and Microservice Template. I am trying to correspond to that title. The most recent related thing was Nuget restructure in Fintech.Shared project. Now I am planning to apply the same approach to Financing (where it is a chore to update the shared model package) and Microservice Template.


What I can do to improve my performance: more proactively communicate with management to gain a deeper understanding of the business perspective. And pushing my project further, than just initial tooling/platforming work. I need to apply that tooling to get a better impact. Keep more attention to our loan processing so it can help more with fixing and improvement.

And at the end, it is important to note that I was on paternity leave in ~ August and October, 15- November 15, so 2 months out of the cycle.


Change Lives:
Why did your results matter? Briefly describe at least 1 example of the impact your work has had on your partners or customers.
What is at least 1 action item you can implement to make a greater impact going forward?
Metrics definitely would have an impact. They provide observability of calculation issues and visibility to loan rejections. That will allow us to quickly react to the problem and reduce the number of customers who faced the issue, making their lives better. Work on Financing Dashboards (data migration and cleanup) will have the same impact.

I had a lot of conversations with the infra team last 6 months. Some of them, like metrics, resulted in the Infra team refining their processes, some tooling was closed and removed from docs so new users were not confused. Also some positive changes were implemented. That would help others who will pursue metrics. 
A less positive experience I had with a conversation about the whole company shared template https://docs.st.dev/docs/backend/microservice-template/ms-template/
But I do hope some of the notes and shared experiences will be noted and used. That is especially interesting considering that I created a microservice template for our team which was used to spearhead the development of GoodLeap and WellsFargo adapters
https://github.com/servicetitan/goodleap-adapter
https://github.com/servicetitan/wellsfargo-adapter
At the bottom of the readme, there is Template Version: 0.2.0 of a used template. 
So I can say my template is making a difference beyond my role and will continue to do so as more services use it, until we have a companywide template.


I also recognize the importance of enhancing my spoken English communication skills to have a greater impact and positively influence more lives. Specifically, in the context of the paragraph, this involves the ability to persuade others effectively.


Be a Dream Team:
How did you make your fellow Titans better? Briefly describe how you have collaborated and partnered with fellow Titans, considering 360 / peer feedback received.
What is at least 1 action item you can implement to improve collaboration & partnership going forward?

I always try to foster good relationships with team members. I believe this is probably the best team I ever worked with. I am always trying to help if I can, and enjoying helping with tech advice and not only. I love helping QA with tech basics like browser console. At the same time, I’m not shy to point others at their mistakes or missing, believing without that feedback you don’t have a way to improve.
I believe that a collaboration with Jose Nunez can be an example of positive communication when we worked on unit test coverage and finally came up with details of the implementation of self-hosted web app for integration tests. 
Not just technical collaboration! I may not be the heart of the company, but I'm doing my part. For instance, during the Fintech Onsite in August, Arpine, Hovsep, Jose, and Steven came from different places. After a long meeting, when most went home, I organized a team-building event for them, taking advantage of their visit to LA. I led a guided tour of Griffith Observatory, highlighting the idea of us being a Dream Team.
I realize that I could do better in initiations of collaborative work and demonstrate greater initiative.





# Cornerstone
Developed Kong plugin that executed billions of times per day
Improved architecture of company-wide service templates, helped a lot agaisnt nuget hell.

Design and development of high throughput data migration system. I developer Control Plane that was orchestrating millions sync operations per hours, with robustness and resilence, restoration from failure etc. 
Scheduling orchestrating job state management

