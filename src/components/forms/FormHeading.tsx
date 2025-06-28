import React from "react";

const FormHeading = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  return (
    <>
      <h2 className="text-3xl sm:text-3xl md:text-3xl font-lexend font-medium mb-3 text-center md:text-left" dangerouslySetInnerHTML={{ __html: title }}></h2>
      <p className="text-base sm:text-base md:text-base text-gray-600 text-center md:text-left  mb-8">{description}</p>
    </>
  );
};

export default FormHeading;
